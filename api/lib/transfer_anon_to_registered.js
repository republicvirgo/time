var ES    = require('esta');
var aguid = require('aguid');
var Hoek  = require('hoek');
var JWT   = require('jsonwebtoken'); // https://github.com/docdis/learn-json-web-tokens
var JWTSign = require('../lib/auth_jwt_sign.js'); // used to sign JWTS duh.
var find_all = require('../handlers/timer_find_all'); // see: http://git.io/vvf7k
/**
 * The purpose of this method is to transfer the session
 * and all existing timers from an anonymous person to their
 * registered account on the system.
 * so... first thing is we lookup their session id from the JWT
 */

module.exports = function(req, reply) {
  var personid = aguid(req.payload.email);
  // console.log(' TRANSFER: - - - - - - - - - - - - - - - - -> '+req.payload.email);
  var token = req.headers.authorization;
  JWT.verify(token, process.env.JWT_SECRET, function(err, decoded) {
    var session = {
      index : "time",
      type  : "session",
      id    : decoded.jti,
      person: personid
    }
    var session_copy = {
      index : "time",
      type  : "session",
      id    : decoded.jti,
      person: personid
    }
    req.auth = {
      credentials : {
        person: personid
      }
    }

    ES.READ(session, function(ses) {
      // console.log("Anon SESSION :",ses);
      var session = ses._source;
      session.index = "time";
      session.type = "session";
      session.person = personid;
      session.id = decoded.jti;

      // set the person.id of Existing Session
      ES.UPDATE(session, function(res2) {
        ES.READ(session_copy, function(res4){
          // lookup all the records that were created with the anon session
          // before the person decided to login...
          var query =  {
            "index": "time",
            "type": "timer",
            "field": "session",
            "text": decoded.jti
          };

          ES.SEARCH(query, function(res) {
            // console.log(res.hits.total);
            // console.log(" - - - - - - - - - - hits: ");
            var countdown = res.hits.total;
            res.hits.hits.forEach(function(hit){
              // console.log(hit);
              var timer = hit._source;
              timer.id = hit._id;
              timer.index = hit._index;
              timer.type = hit._type;
              timer.person = personid; // the whole point of this!
              ES.UPDATE(timer, function(res){
                // console.log("VERSION:",res._version);
                countdown--;
                if(countdown === 0) {
                  return find_all(req, reply, 200);
                  // return reply(res).header("Authorization", token);
                } else { } // do nothing istanbul!!
              })
            }) // END forEach
            // return reply(res).header("Authorization", token);
          }); // END SEARCH
        }) // END ES.READ  (ensure that the records have been updated)
      }); // END session UPDATE
    }); // END ES.READ (lookup existing session)
  }); // END JWT.verify
}
