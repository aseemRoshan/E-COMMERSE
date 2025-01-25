const express = require('express');
const app = express();
const env = require('dotenv').config()
const db = require('./config/db');
db();






const PORT = process.env.PORT || 3000;
app.listen(process.env.PORT, ()=>{
    console.log(`Server Running`);
    
})

module.exports = app;