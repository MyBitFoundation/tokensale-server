/**
 * Created by shumer on 2/23/17.
 */
// import ;
let scryptAsync = require('scrypt-async'),
    ethUtil = require('ethereumjs-util'),
    cryptoJS = require('crypto-js');

module.exports = {
    generateBrainkey(seed, salt, callback){

        scryptAsync(seed, salt, { N: 16384, r: 8, p: 1, dkLen: 64, encoding: 'hex'}, (hexString)=>{
            callback(ethUtil.sha3(hexString).toString());
        });
    },

    encryptBrainKey(brainKey, password){
        return cryptoJS.AES.encrypt(brainKey, password);
    },

    decryptBrainKey(cryptedBrainKey, password){
        let bytes  = cryptoJS.AES.decrypt(cryptedBrainKey, password);
        return bytes.toString(cryptoJS.enc.Utf8);
    }
};