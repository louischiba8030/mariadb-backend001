const { google } = require('googleapis')
const express = require('express')
const mariadb = require('mariadb')
const sqlite3 = require('sqlite3').verbose()
const fs = require('fs')
const app = express()

const credentials = require('../../primeval-yew-300923-f470150bd226.json')
const spreadSheetKey = '1pkum77TIdtcstl5ts-KYLqqTiUaNBkYH4Zs4wh800jI'
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
const baseSheetTitle = '抽出データ_'
const range = 'A3:E'

// mariadb
const pool = mariadb.createPool({
		host: 'localhost',
		user: 'dbuser',
		password: '12ab',
		database: 'alcoholgel_data',
		connectionLimit: 5,
})

app.set('view engine', 'ejs')

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

const j2a_converter = (data) => {
	let {Date, staff_id, name, al_amount, position } = data
	return [Date, staff_id, name, al_amount, position]
}

async function writeDataToMariaDb(data) {
	let conn
	try {
		conn = await pool.getConnection()
		arranged_arr = data.map(j2a_converter)
		console.log(arranged_arr)

		conn.batch('INSERT INTO may2021(Date, staff_id, name, al_amount, position) VALUES(?, ?, ?, ?, ?)', arranged_arr)
			.then(res => {
				console.log("res: " + JSON.stringify(res))
			})
			//sql: 'INSERT INTO may2021 SET Date=?, staff_id=?, name=?, al_amount=?, position=?',
			//sql: 'INSERT INTO may2021(Date, staff_id, name) VALUES(?, ?, ?)',
			//timeout: 40000,
			//values: [["2021/05/13", 200365, "Kohara"], ["2021/05/14", 380097, "Ryo"]]
			//values: [arranged_arr[0][0], arranged_arr[0][1], arranged_arr[0][2], arranged_arr[0][3], arranged_arr[0][4]]
			//values: [[arranged_arr[0][0], arranged_arr[0][1], arranged_arr[0][2], arranged_arr[0][3], arranged_arr[0][4]], [arranged_arr[1][0], arranged_arr[1][1], arranged_arr[1][2], arranged_arr[1][3], arranged_arr[1][4]]]
		//}, (err, res) => {
		//	console.log("res: " + res.json())
		//})
	} catch (err) {
		throw err
	} finally {
		if(conn) return conn.end()
	}
}

const server = app.listen(8080, () => {
	console.log("Node.js is listening to PORT: " + server.address().port)
})

app.get('/', (req, res, next) => {
	res.render('hello', {})
})

const readMariaDb = async(ymonth) => {
	let conn

	// Convert ymonth"2021年5月" -> table_name "may2021"
	const month_eng_list = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
	target_year = ymonth.match(/^[0-9]{4}/)
	target_month = ymonth.match(/^.*\D+(\d+)\D+$/)
	tbl_name = month_eng_list[(target_month[1])-1]+target_year

	const queryStr = `SELECT Date, staff_id, name, al_amount, position FROM ${tbl_name}`
	try {
		conn = await pool.getConnection()
		const rows = await conn.query(queryStr)
		delete rows.meta
		return rows
	} catch (err) {
		throw err
	} finally {
		if(conn) conn.end()
	}

}

app.get('/api/v1/:ymonth', (req, res, next) => {
	readMariaDb(req.params.ymonth).then(result => {
		res.json(result)
	})	
})

app.get('/api/calendar2', (req, res, next) => {

console.log("arr_Date" + arr.Date)
	let db = new sqlite3.Database('./alcoholgel_data.sqlite', sqlite3.OPEN_READWRITE, (err) => {
		if(err) { console.error(err.message) }
		console.log('Connected to the database')
	}) //end let db

	getSheetData().then(result => {
		db.serialize(() => {
			db.all('SELECT * FROM may2021', (err, rows) => {
				if(err) {
					throw err
				}
				rows.forEach((row) => {
					console.log(row.staff_id + ' ' + row.name)
				})
			}) // end db.all

			const stmt = db.prepare('INSERT or ignore INTO may2021 (Date, staff_id, name, al_amount, position) values  (?, ?, ?, ?, ?)')
			for(let i=0;i<result.length;i++){
				stmt.run (
				result[i].Date,
				result[i].staff_id,
				result[i].name,
				result[i].al_amount,
				result[i].position
			)}
			stmt.finalize()

			db.close((err) => {
				if(err) {
					console.error(err.message)
				}
				console.log('Close the database connection.')
			}) // end db.close
		}) // end db.serialize
	}) // end getSheetData

})

const writeDataToJsonFile = async (arr) => {
	const file = './data_file.json'
	const data = JSON.stringify(arr, null, '    ')
	fs.writeFile(file, data, 'utf-8', (err) => {
		if(err)
			console.error(err)
		else
			console.log("Saved!")
	})
}

app.get('/api/calendar', (req, res, next) => {
	// req kara yyyy/mm wo get suru
	// taiou suru Google Spreadsheet wo shutoku
	// -> array(json) ni kakunou
	//
	//res.json(arr)
	getSheetData().then((result) => {
		writeDataToMariaDb(result)
		//writeDataToJsonFile(result)

		res.json({
			"rows": result
		})
	})
})

