const { google } = require('googleapis')
const express = require('express')
const mariadb = require('mariadb')
const app = express()

const credentials = require('./primeval-yew-300923-f470150bd226.json')
const spreadSheetKey = '1pkum77TIdtcstl5ts-KYLqqTiUaNBkYH4Zs4wh800jI'
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
const sheetTitle = '抽出データ_2021年5月'
const range = 'A3:E3'

// mariadb
const pool = mariadb.createPool({
		host: 'localhost',
		user: 'dbuser',
		password: '12ab',
		database: 'alcoholgel_data',
		connectionLimit: 5,
})

// functions
async function getSheetData() {
	try {
		const target = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
		const jwt = new google.auth.JWT(
			credentials.client_email,
			null,
			credentials.private_key,
			target
		);

		const sheets = google.sheets({ version: 'v4' });
		const response = await sheets.spreadsheets.values.get({
			auth: jwt,
			spreadsheetId: spreadSheetKey,
			range: range,
			majorDimension: "ROWS",
		});

		const rows = response.data.values;
		if(rows.length) {
			return rows.map((row) => ({
				Date: row[0],
				staff_id: parseInt(row[1]),
				name: row[2],
				al_amount: parseInt(row[3]),
				position: row[4] || null,
			}))
		}
	} catch (err) {
		console.error("Error: " + err)
	}
}


async function writeDataToMariaDb(arr) {
	let conn
	const ison = {
		Date: "2021/05/31",
		staff_id: 200365,
		name: "kohara",
		al_amount: 100,
		position: "看護部長室"
	}
	try {
		conn = await pool.getConnection()
		responseJson = JSON.stringify(arr)
		console.log("responseJson: " + responseJson)
		//return await conn.query(`INSERT INTO may2021 SET ?`, responseJson, (err, res) => {
		return await conn.query(`INSERT INTO may2021 SET ?`, ison, (err, res) => {
			console.log("res: " + res)
		})
	} catch (err) {
		throw err
	} finally {
		conn.end()
	}
}

const server = app.listen(8080, () => {
	console.log("Node.js is listening to PORT: " + server.address().port)
})

app.get('/', (req, res, next) => {
	res.render('hello', {})
})

app.get('/api/calendar2', (req, res, next) => {

})

app.get('/api/calendar', (req, res, next) => {
	// req kara yyyy/mm wo get suru
	// taiou suru Google Spreadsheet wo shutoku
	// -> array(json) ni kakunou
	//
	//res.json(arr)
	getSheetData().then((result) => {
		writeDataToMariaDb(result)
	})
})

