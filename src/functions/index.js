import * as functions from "firebase-functions"
const admin = require('firebase-admin')
admin.initializeApp({
    credential: admin.credential.applicationDefault() 
})
const state = {
  GEN_CODE: 'GEN_CODE',
  FIND_CODE: 'FIND_CODE',
  USE_CODE: 'USE_CODE',
  VALIDATE_DATA: 'VALIDATE_DATA'
}

const sampleCode = [
  'AAAAA',
  'BBBBB',
  'CCCCC',
  'DDDDD',
  'EEEEE',
  'FFFFF',
  'GGGGG',
  'HHHHH',
  'IIIII',
  'JJJJJ',
  'KKKKK'
]

const db = admin.firestore()

export let getDiscount = functions.https.onRequest(async (req, res) => {
  let promoCode = req.query.promoCode
  let promotion = await db.collection('promoCode').doc(promoCode).get()
  if (promotion.exists) {
    let data = promotion.data()
    res.send({
      ...data,
      promoCode: promoCode
    })
  } else {
    res.send(null)
  }
})

export let checkOut = functions.https.onRequest(async (req, res) => {
  let {tel, net, promoCode} = req.query
  if (!((tel) && (net)) || !(/^\d+$/.test(net))) {
    res.status(400).send('Bad Values!!')
    return
  }

  if (promoCode) {
    let now_Date = new Date()
    const promotion = await db.runTransaction(transaction => {
      return transaction.get(db.collection('promoCode').doc(promoCode))
      .then (async selectedPromotion => {
        if (selectedPromotion.exists && selectedPromotion.data().status === 'unused' && (selectedPromotion.data().exp_date > now_Date)) {
          setStatus(selectedPromotion.data().type, promoCode) // set Status to used
    
          net = await getNetDiscount (  // set getDiscount Price
            net,
            selectedPromotion.data().discount_type,
            selectedPromotion.data().discount_number
          )
        } else {
          // Log Code can not be used.
        }
      })
    }).then(() => {
      console.log('Success')
    }).catch(err => {
      console.error(err)
    })
  }
  const result = await getCode(tel, net)
  res.send(result)
})

function getNetDiscount (net, discountType, discountNumber) { // Test
  if (discountType === 'Baht') {
    net = net - discountNumber
  } else if (discountType === '%') {
    net = net - ((net * discountNumber) / 100)
  }
  return net
}

function setStatus (type, promoCode) {
  if (type === 'onetime') {
    db.collection('promoCode').doc(promoCode).update({
      status: 'used'
    })
  }
}

async function getCode (tel, net) {
  const result = await db.collection('vip').doc(tel).get()
  let count = 0
  let generatedCode = sampleCode[count]
  if (result.exists && net >= 3000) {
    // await db.collection('promoCode').doc('totalDocumentOfPromotionCode').set(newCode)
    const promotion = await db.runTransaction(transaction => {
        return transaction.get(db.collection('promoCode').doc('totalDocumentOfPromotionCode'))
        .then (async t => {
          count = 0
          let newDocument = t.data().promoCode
          while (newDocument.find(code => code === generatedCode) === generatedCode) {
            generatedCode = sampleCode[++count]
          }
          newDocument.push(generatedCode)
          transaction.update(db.collection('promoCode').doc('totalDocumentOfPromotionCode'), { promoCode: newDocument });
      }).then(async () => {
        await setNewDocumentPromoCode (generatedCode)
      }).catch(err => {
        console.error(err)
      })
    })
    
    return ({ Code : generatedCode, Net : net})
  } else {
    return ({Net: net})
  }
}

async function setNewDocumentPromoCode (generatedCode) {
  let createDate = new Date()
  let expDate = new Date(createDate.getFullYear(), createDate.getMonth()+3, createDate.getDay(), createDate.getHours(), createDate.getMinutes(), createDate.getSeconds())
  let newCode = {
    create_date: createDate,
    discount_number: 300,
    discount_type: 'Baht',
    exp_date: expDate,
    status: 'unused',
    type: 'onetime'
  }
  await db.collection('promoCode').doc(generatedCode).set(newCode)
}

function genCode() { // check Code
  let code
  let message = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  do {
    code = ''
    for (let i = 0; i < 5; i++) {
      code += message.charAt(Math.floor(Math.random() * message.length))
    }
  } while (checkCode(code))
  return code
}

function checkCode (code) {
  const transaction = db.runTransaction(t => {
    return t.get(db.collection('promoCode').doc(code))
  })
  return transaction.exists
}

function setLog (raw, state, result) {
  db.collection('logs').add({
    time: new Date(),
    state: state,
    result: result,
    raw: raw
  })
}

// const message = () => {
//   return new Promise(resolve => {
//     setTimeout(() => {
//       resolve(`from Babelified Cloud Functions!`)
//     }, 1000)
//   })
// }

// export let helloWorld = functions.https.onRequest(async (req, res) => {
//   let world = await message()
//   res.status(200).send(`Hello ${world}`)
// })
