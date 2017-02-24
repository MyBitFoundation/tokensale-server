/**
 * Created by shumer on 2/23/17.
 */
// import ;
let scryptAsync = require('scrypt-async'),
    ethUtil = require('ethereumjs-util'),
    cryptoJS = require('crypto-js');

module.exports = {
    generateBrainKey(seed, salt, callback){
        scryptAsync(seed, salt, { N: 16384, r: 8, p: 1, dkLen: 64, encoding: 'hex'}, (hexString)=>{
            let brainKeyBuffer = ethUtil.sha3(hexString);

            callback(ethUtil.isValidPrivate(brainKeyBuffer) ? ethUtil.bufferToHex(brainKeyBuffer) : null);
        });
    },

    publicFromPrivate(privateKeyString){
        let privateKeyBuffer = ethUtil.toBuffer(privateKeyString);

        if(!ethUtil.isValidPrivate(privateKeyBuffer)){
            return null;
        }

        let publicKeyBuffer = ethUtil.privateToPublic(privateKeyBuffer);

        return (ethUtil.isValidPublic(publicKeyBuffer) ? ethUtil.bufferToHex(publicKeyBuffer) : null);
    },

    encryptBrainKey(brainKey, password){
        return cryptoJS.AES.encrypt(brainKey, password).toString();
    },

    decryptBrainKey(cryptedBrainKey, password){
        let bytes  = cryptoJS.AES.decrypt(cryptedBrainKey, password);
        return bytes.toString(cryptoJS.enc.Utf8);
    }
};