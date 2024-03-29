const _ = require('lodash')
const axios = require('axios')
const createError = require('http-errors')
const JSON5 = require('json5')

const errToString = (() => {
  const ERROR_KEYS = [
    'address',
    'code',
    'data',
    'dest',
    'errno',
    'info',
    'message',
    'name',
    'path',
    'port',
    'reason',
    'response.data',
    'response.headers',
    'response.status',
    'stack',
    'status',
    'statusCode',
    'statusMessage',
    'syscall',
  ]
  return err => ({
    ..._.pick(err, ERROR_KEYS),
    ...(_.isNil(err.originalError) ? {} : { originalError: errToString(err.originalError) }),
  })
})()

class Telegram {
  static async get (token, path) {
    const res = await axios.get(`https://api.telegram.org/bot${token}/${path}`)
    if (!_.get(res, 'data.ok')) throw createError(_.get(res, 'data.error_code', 500), _.get(res, 'data.description'))
    return _.get(res, 'data.result')
  }

  static async post (token, path, params) {
    const res = await axios.post(`https://api.telegram.org/bot${token}/${path}`, params)
    if (!_.get(res, 'data.ok')) throw createError(_.get(res, 'data.error_code', 500), _.get(res, 'data.description'), { response: res })
    return _.get(res, 'data.result')
  }

  static async getMe (token) {
    return await Telegram.get(token, 'getMe')
  }

  // https://core.telegram.org/bots/api#sendmessage
  static async sendMessage (token, params) {
    const data = await Telegram.post(token, 'sendMessage', params)
    console.log('sendMessage =', JSON.stringify(data))
    return data
  }
}

exports.main = async (req, res) => {
  try {
    console.log('req.body =', JSON.stringify(req.body))

    // get access token
    const token = req.path.substring(1)
    if (!/^[a-zA-Z0-9:-]+$/.test(token)) throw createError(401, 'wrong bot token')

    // webhook update
    let message, response

    // https://core.telegram.org/bots/api#update
    for (const k of [
      'body.edited_message',
      'body.message',
    ]) {
      if (_.hasIn(req, k)) {
        message = _.get(req, k)
        break
      }
    }

    // https://core.telegram.org/bots/api#message
    if (_.hasIn(message, 'text')) {
      try {
        const tmp = JSON5.parse(message.text)
        if (_.hasIn(tmp, 'text')) response = tmp
      } catch (err) {
        console.log(errToString(err))
      }
    }

    if (!response) {
      response = JSON.stringify(req.body)
    }

    const chatId = message?.migrate_to_chat_id ?? message?.chat?.id
    if (!_.isNil(chatId)) {
      if (_.isPlainObject(response)) {
        await Telegram.sendMessage(token, {
          chat_id: chatId,
          ...response
        })
      } else {
        await Telegram.sendMessage(token, {
          chat_id: chatId,
          text: response
        })
      }
    }

    res.status(200).send('OK')
  } catch (err) {
    console.log(errToString(err))
    res.status(err.status || 500).send(err.message)
  }
}
