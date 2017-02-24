/**
 * Created by shumer on 2/24/17.
 */
"use strict";

let main = (Connect) => {
    let Schema = new Connect.Schema({
        name: {
            type: String,
            required: true,
            default : false
        },
        value : {
            type : String,
            required : true,
            default : false
        }
    }, {
        timestamps: true
    });
    let model = Connect.model('settings', Schema);

    // only for tips in IDE
    let Models = {
        settings: model
    };
    return model;
};
module.exports = main;