"use strict"
const pos = require('pos')
const MINUTE_LENGTH = 30
const moment = require('moment')
const sentiment = require('sentiment')

exports.mostFavorited = function(messages) {
  var max = 0
  var toRet
  messages.forEach((msg) => {
    if (msg['favorited_by'].length > max) {
      max = msg['favorited_by'].length
      toRet = msg
    }})
  return {
    msg: toRet,
    count: max
  }
}

exports.measureParticipants = function(messages, members) {
  messages.forEach((element) => {
    if (!isNaN(element['sender_id']) && element['sender_id']) {
      const currMember = members[members.findIndex((member) => {
        return member['user_id'] === element['sender_id']
      })]
      if (currMember) {
        currMember.count = (currMember.count === undefined ||
          currMember.count === null) ? 0 : currMember.count + 1
      }
    }
  })
  let totalCount = 0
  members.forEach((member) => {
    if (member.count) {
      totalCount += member.count
    }
  })
  members.forEach((member) => {
    member.percentage = Math.round((member.count * 100) / (totalCount))
  })
  return members
}

exports.plotDensity = function(messages) {
  //get earliest and latest times
  var times = messages.map(function(msg) {return msg['created_at']})
  var earliest = moment.unix(Math.min.apply(null, times))
  var latest = moment.unix(Math.max.apply(null, times))
  var namesMap = {}
  messages.forEach((msg) => {
    if (msg['name'] !== 'GroupMe') {
      const name = msg.name
      namesMap[name] = namesMap[name] === undefined ? 1 : namesMap[name] + 1
    }})

  var namesList = Object.keys(namesMap).sort((key) => namesMap[key])
  var countList = []
  for (var key in namesMap) {
    countList.push(namesMap[key])
  }
  countList.sort()
  namesList = namesList.filter(function(item, pos) {
        return namesList.indexOf(item) == pos;
  })
  var sortedMap = []
  countList.forEach(function (value, i) {
      sortedMap.push({'label': namesList[i], 'value':countList[i]})
  })

  //initialize
  var stackedData = []
  for (var i = 0; i < 24; i++) {
    var toAdd = {}
    namesList.forEach((name) => {
      var curr = {[name] : 0}
      Object.assign(toAdd, curr)
    })
    var currHour = {'hour': hourConverter(i)}
    Object.assign(currHour, toAdd)
    var totNum = {'tot' : (messagesAt(i, messages))}
    Object.assign(currHour, totNum)
    stackedData.push(currHour)
  }

  var countSystem = 0
  messages.forEach((msg) => {
    var hour = parseInt(moment.unix(msg['created_at']).format("HH"))
    var name = msg['name']
    stackedData[hour][name] += 1
    if (msg['system'] == true) {
      countSystem++;
    }
  })

  return {
      names: namesList,
      sortedNames: sortedMap,
      toPlot: stackedData,
      length: messages.length - countSystem,
    }
  }


exports.findLovers = function(messages, members) {
  //compare messages for each member, make adj list for convos between users
  const frequentConvos = logFrequentChatPairs(messages, members)
  // find the largest element in frequentConvos for lovers
  let max = -1
  let maxKey = ''
  Object.keys(frequentConvos).forEach((key) => {
    const curr = frequentConvos[key].count
    if (max < curr) {
      max = curr
      maxKey = key
    }
  })
  //const userId1 = maxKey.substring(0, maxKey.length / 2)
  //const userId2 = maxKey.substring(maxKey.length / 2)
  const userId1 = maxKey.split(',')[0]
  const userId2 = maxKey.split(',')[1]
  const member1 = members.find((member) => member.user_id === userId1)
  const member2 = members.find((member) => member.user_id === userId2)
  if (userId1 && userId2 && member1 && member2) {
    return [{
      user_id: userId1,
      name: member1.nickname,
      img: member1.image_url,
    }, {
      user_id: userId2,
      name: member2.nickname,
      img: member2.image_url,
    }]
  }
  return [{
    user_id: null,
    name: null,
    img: null,
  }, {
    user_id: null,
    name: null,
    img: null,
  }]
}


exports.findMostPopular = function(messages, members) {
  let popularPeople = {}
  const frequentConvos = logFrequentChatPairs(messages, members)
  members.forEach((member) => {
    members.forEach((secondMember) => {
      if (member !== secondMember) {
        const firstID = member['user_id']
        const secondID = secondMember['user_id']
        if (!popularPeople[firstID]) {
          popularPeople[firstID] = {count:0,
                                    messages: new Set(),
                                    sentMessages: new Set(),
                                    totalSentiment: 0,
                                    internalSentiment: 0}
        }
        popularPeople[firstID].count += frequentConvos[firstID + ',' + secondID].count
        frequentConvos[firstID + ',' + secondID]
        .messageTimeStamps
        .forEach((timeStamp) => {
          popularPeople[firstID].messages.add(
          messages.find((message) => {
            return parseInt(message.created_at) === parseInt(timeStamp)
          }).text)
        })
        frequentConvos[firstID + ',' + secondID]
        .selfTimeStamps
        .forEach((timeStamp) => {
          popularPeople[firstID].sentMessages.add(
          messages.find((message) => {
            return parseInt(message.created_at) === parseInt(timeStamp)
          }).text)
        })
      }
    })
  })
  //convert set to array and count total sentiment
  members.forEach((member) => {
    const firstID = member['user_id']
    popularPeople[firstID].messages = Array.from(popularPeople[firstID].messages)
    popularPeople[firstID].messages.forEach((message) => {
      if (message) {
        popularPeople[firstID].totalSentiment += sentiment(message).score
      }
    })
    popularPeople[firstID].sentMessages.forEach((message) => {
      if (message) {
        popularPeople[firstID].internalSentiment += sentiment(message).score
      }
    })
  })


  //find most popular person with correct name
  let max = -1
  let maxKey = ''
  let mostHated = 50
  let hatedKey = ''
  let mostLiked = -50
  let likedKey = ''
  let mostSad = 50
  let sadKey = ''
  let mostHappy = -50
  let happyKey = ''

  Object.keys(popularPeople).forEach((key) => {
    const curr = popularPeople[key].count
    if (max < curr) {
      max = curr
      maxKey = key
    }
    let currSentiment = popularPeople[key].totalSentiment
    if (mostHated > currSentiment) {
      mostHated = currSentiment
      hatedKey = key
    }
    if (mostLiked < currSentiment) {
      mostLiked = currSentiment
      likedKey = key
    }
    currSentiment = popularPeople[key].internalSentiment
    if (mostSad > currSentiment) {
      mostSad = currSentiment
      sadKey = key
    }
    if (mostHappy < currSentiment) {
      mostHappy = currSentiment
      happyKey = key
    }
  })
  return {
    popular: {
      user_id: maxKey,
      name: members.find((member) => member.user_id === maxKey).nickname,
      messages: popularPeople[maxKey].messages,
      img: members.find((member) => member.user_id === maxKey).image_url,
    },
    hated: {
      user_id: hatedKey,
      name: members.find((member) => member.user_id === hatedKey).nickname,
      messages: popularPeople[hatedKey].messages,
      img: members.find((member) => member.user_id === hatedKey).image_url,
    },
    liked : {
      user_id: likedKey,
      name: members.find((member) => member.user_id === likedKey).nickname,
      messages: popularPeople[likedKey].messages,
      img: members.find((member) => member.user_id === likedKey).image_url,
    },
    sad: {
      user_id: sadKey,
      name: members.find((member) => member.user_id === sadKey).nickname,
      messages: popularPeople[sadKey].messages,
      img: members.find((member) => member.user_id === sadKey).image_url
    },
    happy: {
      user_id: happyKey,
      name: members.find((member) => member.user_id === happyKey).nickname,
      messages: popularPeople[happyKey].messages,
      img: members.find((member) => member.user_id === happyKey).image_url,
    }
  }

}

function messagesAt(i, messages) {
  var count = 0
  messages.forEach((msg) => {
    if (msg['name'] !== 'GroupMe') {
      var hour = parseInt(moment.unix(msg['created_at']).format("HH"))
      if (hour == i) {
        count++
      }
    }})
  return count
}



function hourConverter(hh) {
  var num = parseInt(hh)
  if (num > 12) {
    return (num - 12) + ":00 PM"
  } else if (num == 0) {
    return "12:00 AM"
  } else if (num == 12) {
    return "12:00 PM"
  } else {
    return hh + ":00 AM"
  }
}


function logFrequentChatPairs(messages, members) {
  //get message timestamps for each user
  let conversationTimes = new Object()
  members.forEach((member) => {
    messages.forEach((message) => {
      if (member['user_id'] === message['sender_id']) {
        let conversationArray = conversationTimes[member['user_id']]
        if (!conversationArray) {
          conversationTimes[member['user_id']] = []
          conversationArray = conversationTimes[member['user_id']]
        }
        conversationArray.push(message['created_at'])
      }
    })
  })
  //compare messages for each member, make adj list for convos between users
  let frequentConvos = new Object()
  members.forEach((member) => {
    members.forEach((secondMember) => {
      if (member !== secondMember) {
        const firstID = member['user_id']
        const secondID = secondMember['user_id']
        const firstChat = conversationTimes[firstID]
        const secondChat = conversationTimes[secondID]
        frequentConvos[firstID + ',' + secondID] =
                            logFrequentChats(firstChat, secondChat)
      }
    })
  })
  return frequentConvos
}

function logFrequentChats(firstChat, secondChat) {
  let count = 0
  let messageTimeStamps = []
  let selfTimeStamps = []
  if (!firstChat || !secondChat) {
    return {messageTimeStamps, selfTimeStamps, count}
  }
  let i = firstChat.length - 1
  let j = secondChat.length - 1
  while (j > 0 && i > 0) {
    let diff = firstChat[i] - secondChat[j]
    if (Math.abs(diff) < 60 * 3) {
      ++count
      selfTimeStamps.push(firstChat[i])
      messageTimeStamps.push(secondChat[j])
      i--
      j--
    } else {
      if (diff > 0) {
        j--
      } else {
        i--
      }
    }
  }
  return {messageTimeStamps, selfTimeStamps, count}
}

exports.extremeTimePeople = (messages) => {
  const returnObj = {
    nightOwl: {
      count: -1,
    },
    earlyBird: {
      count: -1,
    },
  }
  const nightMembers = {}
  const dayMembers = {}
  messages.forEach((message) => {
    const currTime = moment.unix(message.created_at)
    if (currTime.isBetween(moment(currTime).set('hour', 4), moment(currTime).set('hour', 10))) {
      let curr = dayMembers[message.user_id]
      dayMembers[message.user_id] = curr === undefined || curr === null ? 0 : curr + 1
      if (curr + 1 > returnObj.earlyBird.count) {
        returnObj.earlyBird.count = curr + 1
        returnObj.earlyBird.user_id = message.user_id
        returnObj.earlyBird.name = message.name
        returnObj.earlyBird.img = message.avatar_url
      }
    } else if (currTime.isBetween(moment(currTime).set('hour', 22), moment(currTime).set('hour', 24))
      || currTime.isBetween(moment(currTime).set('hour', 0), moment(currTime).set('hour', 4))) {
      let curr = nightMembers[message.user_id]
      nightMembers[message.user_id] = curr === undefined || curr === null ? 0 : curr + 1
      if (curr + 1 > returnObj.nightOwl.count) {
        returnObj.nightOwl.count = curr + 1
        returnObj.nightOwl.user_id = message.user_id
        returnObj.nightOwl.name = message.name
        returnObj.nightOwl.img = message.avatar_url
      }
    }
  })
  return returnObj
}

exports.mostPopularWord = (messages) => {
  const tagger = new pos.Tagger()
  const msgCount = {}
  const maxObj = {
    count: 0,
    word: '',
  }
  messages.forEach((message) => {
    if (message.text) {
      const words = new pos.Lexer().lex(message.text)
      tagger.tag(words).forEach((wordArr) => {
        const word = wordArr[0]
        const tag = wordArr[1]
        if (['CC', 'DT', 'EX', 'RP'].indexOf(tag) === -1 && word.length > 1) {
          if (word != "") {
            let curr = msgCount[word]
            msgCount[word] =
              curr === undefined || curr === null ? 1 : ++curr
            if (curr > maxObj.count) {
              maxObj.count = curr
              maxObj.word = word
            }
          }
        }
      })
    }
  })
  return msgCount
}

