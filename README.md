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