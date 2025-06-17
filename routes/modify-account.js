var express = require('express');
var axios = require('axios');
var _ = require('lodash');
var bbfn = require('../functions.js');
var router = express.Router();



router.get('/', function (req, res, next) {
  var user = req.session.userprofile;
  console.log(req.body)
  var loggedIn = ((req.session.loggedIn) ? true : false);
  console.log("User is logged in:", loggedIn);
  console.log(req.session)
  console.log("Modify account started for:", req.session.userEmail);
  res.render('insurance/modify-account', {
    action: '/app/modify-account',
    loggedIn: loggedIn
  });
});


router.post('/', function (req, res, next) {
  var user = req.session.userprofile;
  console.log(req.body)
  var loggedIn = ((req.session.loggedIn) ? true : false);
  var data = req.body;
  console.log("Modified submitted for:", req.session.userEmail);
  console.log("modify account form submitted:", data)
  bbfn.authorize(process.env.API_CLIENT_ID, process.env.API_SECRET, function (err, body) {
    if (err) {
      console.log(err);
    } else {
      var accessToken = body.access_token;
      bbfn.getUserID(req.session.userEmail, accessToken, async function (err, body) {
        if (body === false) {
          var userInfo = {
            "schemas": [
              "urn:ietf:params:scim:schemas:core:2.0:User",
              "urn:ietf:params:scim:schemas:extension:ibm:2.0:User",
            ],
            "userName": req.session.userEmail,
            "name": {
              "familyName": req.session.familyName,
              "givenName": req.session.givenName
            },
            "preferredLanguage": "en-US",
            "active": true,
            "emails": [
              {
                "value": req.session.userEmail,
                "type": "work"
              }
            ],
            "addresses": [
              {
                "postalCode": data.zip,
                "streetAddress": data.streetAddress,
                "locality": data.city,
                "region": data.state
              }
            ],
            "urn:ietf:params:scim:schemas:extension:ibm:2.0:User": {
              "userCategory": "regular",
              "twoFactorAuthentication": false,
              "customAttributes": [
                {
                  "name": "birthday",
                  "values": [data.birthday]
                },
                {
                  "name": "ageHome",
                  "values": [data.ageHome]
                },
                {
                  "name": "homeType",
                  "values": [data.homeType]
                },
                {
                  "name": "quoteCount",
                  "values": [1]
                }
              ]
            }
          }

          console.log("User creation information:", userInfo)
          var options = {
            'method': 'post',
            'url': process.env.OIDC_CI_BASE_URI + '/v2.0/Users',
            'headers': {
              'Content-Type': 'application/scim+json',
              'Authorization': `Bearer ${accessToken}`
            },
            'data': userInfo,
            'params': {
              'themeId': process.env.THEME_ID
            },
          }

          var response = await axios(options);
          console.log("Create user:", req.session.userEmail)
          pbody = response.data;
          console.log("Response code:", response.status);
          console.log("Create response:", JSON.stringify(pbody));
          if (response.status == 201) {
            //success
            res.render('insurance/modify-account-success', {
              quote: 'home',
              formSubmission: JSON.stringify(req.body),
              profileLink: '/app/profile',
              message: `A password has been generated for you and sent to the email you provided us.`,
              loggedIn: loggedIn
            });
          }
          else {
            //fail
            res.render('insurance/open-account-failed');
          }
        }
        else {
          var userId = body.id;
          var hasCustomAttributes = (typeof user["urn:ietf:params:scim:schemas:extension:ibm:2.0:User"]["customAttributes"] != 'undefined') ? true : false;
          var customAttributes = (hasCustomAttributes) ? req.session.userprofile["urn:ietf:params:scim:schemas:extension:ibm:2.0:User"]["customAttributes"] : false
          var quoteCount = (hasCustomAttributes) ? parseInt((_.filter(customAttributes, { 'name': 'quoteCount' }))[0].values.toString()) + 1 : 0;
          console.log("This is the current quoteCount:", quoteCount)

          var operations = `
                    {
                      "op":"add",
                      "path":"urn:ietf:params:scim:schemas:extension:ibm:2.0:User:customAttributes",
                      "value": [{"name": "birthday","values":["${data.birthday}"]}]
                    },
                    {
                      "op":"add",
                      "path":"urn:ietf:params:scim:schemas:extension:ibm:2.0:User:customAttributes",
                      "value": [{"name": "ageHome","values":["${data.ageHome}"]}]
                    },
                    {
                      "op":"add",
                      "path":"urn:ietf:params:scim:schemas:extension:ibm:2.0:User:customAttributes",
                      "value": [{"name": "homeType","values":["${data.homeType}"]}]
                    },
                    {
                      "op":"add",
                      "path":"addresses",
                      "value": [{"postalCode": "${data.zip}","streetAddress": "${data.streetAddress}","locality": "${data.city}","region": "${data.state}"}]
                    },
                    {
                      "op":"add",
                      "path":"urn:ietf:params:scim:schemas:extension:ibm:2.0:User:customAttributes",
                      "value": [{"name": "quoteCount","values":["${quoteCount}"]}]
                    }`

          //don't create user but increase quoteCount by 1
          //get quote count first, and then set that variable and increase by 1 once completed
          bbfn.setCustomAttributes(userId, operations, accessToken, function (err, body) {
            console.log(body)
            if (body === true) {
              //success
              res.render('insurance/modify-account-success', {
                quote: 'car',
                formSubmission: JSON.stringify(req.body),
                profileLink: '/app/profile',
                message: `Your new quote will be ready shortly in your profile`,
                loggedIn: loggedIn
              });
            }
            else {
              //fail
              res.render('insurance/open-account-failed');
            }
          });
        }
      });
    }
  });

});

module.exports = router;
