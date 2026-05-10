const express = require('express');
const cors = require('cors');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;
const EXCEL_FILE = path.join(__dirname, 'attendance.xlsx');
const JSON_FILE = path.join(__dirname, 'attendance.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PICTURES_DIR = path.join(__dirname, 'Picture');
if (!fs.existsSync(PICTURES_DIR)) {
    fs.mkdirSync(PICTURES_DIR, { recursive: true });
    console.log('Created Picture directory');
}

// Initialize Excel file if it doesn't exist
async function initExcel() {
    if (!fs.existsSync(EXCEL_FILE)) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Attendance');
        sheet.columns = [
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Sign In', key: 'signIn', width: 15 },
            { header: 'Sign Out', key: 'signOut', width: 15 },
            { header: 'Duration', key: 'duration', width: 20 },
            { header: 'Timestamp', key: 'timestamp', width: 30 }
        ];
        // Style the header
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4F46E5' }
        };
        sheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
        
        await workbook.xlsx.writeFile(EXCEL_FILE);
        console.log('Created new Excel file:', EXCEL_FILE);
    }
}

// Initialize JSON file if it doesn't exist
function initJson() {
    if (!fs.existsSync(JSON_FILE)) {
        fs.writeFileSync(JSON_FILE, JSON.stringify([], null, 4));
        console.log('Created new JSON file:', JSON_FILE);
    }
}

app.get('/api/attendance', (req, res) => {
    if (fs.existsSync(JSON_FILE)) {
        try {
            const rawData = fs.readFileSync(JSON_FILE, 'utf8');
            const jsonData = JSON.parse(rawData);
            res.status(200).send(jsonData);
        } catch (error) {
            console.error('Failed to read attendance JSON:', error);
            res.status(200).send([]);
        }
    } else {
        res.status(200).send([]);
    }
});

app.post('/api/attendance', async (req, res) => {
    const { name, date, signIn, signOut, duration, timestamp, signOutTimestamp, mode, image } = req.body;
    
    try {
        // 0. Save image if provided
        if (image) {
            const base64Data = image.replace(/^data:image\/jpeg;base64,/, "");
            const action = mode === 'update' ? 'SignOut' : 'SignIn';
            const fileName = `${name.replace(/[^a-z0-9]/gi, '_')}_${action}_${new Date().getTime()}.jpg`;
            const filePath = path.join(PICTURES_DIR, fileName);
            fs.writeFileSync(filePath, base64Data, 'base64');
            console.log(`Saved capture: ${fileName}`);
        }
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(EXCEL_FILE);
        const sheet = workbook.getWorksheet('Attendance');
        
        if (mode === 'update') {
            let targetRow = null;
            sheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // skip header
                if (row.getCell('name').value === name && 
                    row.getCell('date').value === date && 
                    !row.getCell('signOut').value) {
                    targetRow = row;
                }
            });

            if (targetRow) {
                targetRow.getCell('signOut').value = signOut;
                targetRow.getCell('duration').value = duration;
            }
        } else {
            sheet.addRow({ name, date, signIn, signOut, duration, timestamp });
        }
        
        await workbook.xlsx.writeFile(EXCEL_FILE);
        
        // 2. Update JSON
        let jsonData = [];
        if (fs.existsSync(JSON_FILE)) {
            const rawData = fs.readFileSync(JSON_FILE, 'utf8');
            try {
                jsonData = JSON.parse(rawData);
            } catch(e) {
                console.error("Error parsing JSON:", e);
            }
        }

        if (mode === 'update') {
            const index = jsonData.findLastIndex(item => item.name === name && item.date === date && !item.signOut);
            if (index !== -1) {
                jsonData[index].signOut = signOut;
                if (signOutTimestamp) {
                    jsonData[index].signOutTimestamp = signOutTimestamp;
                }
                jsonData[index].duration = duration;
            }
        } else {
            jsonData.push({ name, date, signIn, signOut, duration, timestamp, signOutTimestamp: null });
        }
        
        fs.writeFileSync(JSON_FILE, JSON.stringify(jsonData, null, 4));

        console.log(`Log ${mode}: ${name}`);
        res.status(200).send({ message: 'Files updated' });
    } catch (error) {
        console.error('Update error:', error);
        res.status(500).send({ error: 'Failed to update files' });
    }
});

// Serve static files from the Vite build directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle React routing, return all requests to React app
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

initExcel().then(() => {
    initJson();
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});
