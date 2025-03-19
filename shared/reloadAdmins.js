const pool = require("../db");

module.exports = async () => {
    const response = await pool.query('select * from admins');
    return response.rows.map((row) => row.chat_id)
}