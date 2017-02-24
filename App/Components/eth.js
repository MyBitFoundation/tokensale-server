/**
 * Created by shumer on 2/23/17.
 */
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

    addressFromPrivate(privateKeyString){
        let privateKeyBuffer = ethUtil.toBuffer(privateKeyString);

        if(!ethUtil.isValidPrivate(privateKeyBuffer)){
            return null;
        }

        let addressBuffer = ethUtil.privateToAddress(privateKeyBuffer),
            address = ethUtil.bufferToHex(addressBuffer);

        return (ethUtil.isValidAddress(address) ? address : null);
    },

    addressFromPublic(publicKeyString){
        let publicKeyBuffer = ethUtil.toBuffer(publicKeyString);

        if(!ethUtil.isValidPublic(publicKeyBuffer)){
            return null;
        }

        let addressBuffer = ethUtil.pubToAddress(publicKeyBuffer),
            address = ethUtil.bufferToHex(addressBuffer);

        return (ethUtil.isValidAddress(address) ? address : null);
    },

    encryptWithPassword(decryptedString, password){
        return cryptoJS.AES.encrypt(decryptedString, password).toString();
    },

    decryptWithPassword(encryptedString, password){
        let bytes  = cryptoJS.AES.decrypt(encryptedString, password);
        return bytes.toString(cryptoJS.enc.Utf8);
    }
};