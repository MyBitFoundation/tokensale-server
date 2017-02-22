/**
 * Created by shumer on 2/21/17.
 */
let main = (Connect) => {
    let TransactionSchema = new Connect.Schema({
        withdraw : String,
        incomingCoin : Number,
        incomingType : String,
        address : String,
        outgoingCoin : Number,
        outgoingType : String,
        transaction : String,
        fundAmount : Number
    });

    let Schema = new Connect.Schema({
        userId : {
            type: String,
            required: true
        },
        orderId : {
            type: String,
            required: true
        },
        deposit: {
            type: String,
            index: {unique: true},
            required: true
        },
        depositType: {
            type: String,
            required: true
        },
        extraInfo: {
            type: String,
            default : false,
            required: false
        },
        transaction : {
            type : TransactionSchema,
            default : false,
            required : false
        },
        executedAt : {
            type: Date,
            default: null
        }
    }, {
        timestamps: true
    });
    let model = Connect.model('deposit_wallets', Schema);

    let Models = {
        depositWallets: model
    };
    return model;
};
module.exports = main;