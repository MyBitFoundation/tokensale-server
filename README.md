# MyBit Server

## API Description

### `POST` /users/registration
Register user
#### request
```json
{
	"email": "test34t@test.com",
	"password": "111111",
	"address": "0x1Ed9b72CF4ADcd9D78aF611E665cA1d2fc397a39",
	"referrer_key": "SkC_xhXB-"
}
```
`address` and `referrer_key` is not required

### `GET` /users/referrals
Get user referrals

#### response
```json
[
	{
		"_id": "5966308c8509ff642dbc5d0b",
		"email": "test34t@test.com",
		"address": "0x1Ed9b72CF4ADcd9D78aF611E665cA1d2fc397a39",
		"contributeEthAmount": 0
	}
]
```

### `POST` /crowdsale/deposit
Generate new address for deposit

#### request
```json
{
	"currency": "BTC"
}
```

#### response
```json
{
	"address": "19F0sdf8sdfaas0334koko2kpokjjas",
    "type": "BTC",
    "extra": "",
    "min": 0.001
}
```

### `GET` /crowdsale/info
Get info about current crowdsale state

#### response
```json
{
	"_id": null,
	"amount": 1.057716735214788,
	"tokens": 141.0288980286384,
	"countInvestors": 2,
	"amountInUsd": 157.7711436581082
}
```