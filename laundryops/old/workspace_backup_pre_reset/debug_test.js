const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('거래명세서프로그램v35.html', 'utf-8');
const dom = new JSDOM(html);
const document = dom.window.document;

console.log("adminSentList exists?", !!document.getElementById('adminSentList'));
