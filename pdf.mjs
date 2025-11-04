import fs from 'fs';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { Client } from "@hubspot/api-client";
import { Readable } from "stream";
import dotenv from 'dotenv';

const app = express();
const PORT = process.env.PORT || 4000;
app.use(cors());
app.use(express.json());

function generateHTML(templatePath, data) {
    const html = fs.readFileSync(templatePath, "utf8");
    const template = Handlebars.compile(html);
    return template(data);
}

function bufferToStream(buffer) {
    const readable = new Readable();
    readable._read = () => { };
    readable.push(buffer);
    readable.push(null);
    return readable;
}

const hubspot = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

async function generatePDF(html, filename) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
        // path: outputPath,
        format: "A4",
        printBackground: true,
    });
    await browser.close();

    const pdfStream = bufferToStream(pdfBuffer);

    const uploadResponse = await hubspot.files.filesApi.upload(
        {
            data: pdfStream,
            name: `agreement_${filename}_${Date.now()}.pdf`,
        },
        undefined,
        '/ClearBridge',
        `agreement_${filename}_${Date.now()}.pdf`,
        undefined,
        JSON.stringify({
            access: "PUBLIC_INDEXABLE",
            overwrite: false,
            duplicateValidationStrategy: "NONE",
            duplicateValidationScope: "ENTIRE_PORTAL",
        })
    );

    console.log("✅ Uploaded file:", uploadResponse);
    return uploadResponse.data;
}


app.get('/client-registration-pdf', async (req, res) => {
    const client = {
        "surname": "Doe",
        "givename": "John",
        "chinesename": "约翰·多伊",
        "dateofbirth": "1990-01-01",
        "passportnumber": "A12345678",
        "nationality": "Hong Kong",
        "hometelephone": "+852 1234 5678",
        "educationlevel": "Postgraduate",
        "occupation": "Software Engineer",
        "isImmunCellStored": "Yes",
        "locationofstorage": "Hong Kong",
        "mobilephone": "+852 8765 4321",
        "residentialaddress": "123 Clear Bridge St, Hong Kong",
        "correspondenceaddress": "PO Box 123, Hong Kong",
        "emailaddress": "mikealpha@abc.xyz",
        "whatsappnumber": "+852 1122 3344",

        "emergencycontactsurname": "Jane",
        "emergencycontactgivenname": "Smith",
        "emergencycontactchinesename": "简·史密斯",
        "emergencycontacttelephone": "+852 9988 7766",
        "emergencycontactmobilephone": "+852 6677 8899",

        "physiciansurname": "Brown",
        "physiciangivenname": "Emily",
        "physicianchinesename": "艾米丽·布朗",
        "physicianclinicname": "Health Clinic",
        "bloodcollectionstarttime": "2024-06-01 10:00",
        "bloodcollectionendtime": "2024-06-01 11:00",
        "bloodpressurebeforecollection": "120/80",
        "bloodpressureaftercollection": "118/78",
        "temperature": "36.5°C",

        "storageplan": "Blueprint 5",
        "paymentmethod": "Credit Card",
        "cardorchequenumber": "4111 1111 1111 1111",

        "signature": "data:image/png;base64,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",
        "date": "2024-05-15",
    }

    try {
        const html = generateHTML("./html/index.html", client);
        const data = await generatePDF(html, `client-registration-form`);
        res.status(200).json({ message: 'PDF generated successfully', data: data });
    } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).json({ message: 'Error generating PDF', error: error.message });
    }
})

app.get('/health-history-pdf', async (req, res) => {

    const client = {
        "surname": "Doe",
        "givename": "John",
        "chinesename": "约翰·多伊",
        "dateofbirth": "1990-01-01",
        "passportnumber": "A12345678",
        "gender": "Male",
        "nationality": "Hong Kong",
        "hometelephone": "+852 1234 5678",
        "educationlevel": "Postgraduate",
        "occupation": "Software Engineer",
        "isImmunCellStored": "Yes",
        "locationofstorage": "Hong Kong",
        "mobilephone": "+852 8765 4321",
        "residentialaddress": "123 Clear Bridge St, Hong Kong",
        "correspondenceaddress": "PO Box 123, Hong Kong",
        "emailaddress": "mikealpha@abc.xyz",
        "whatsappnumber": "+852 1122 3344",

        "maritalstatus": "Married",
        "noofchildren": "2",
        "dateoflasthealthscreening": "2023-12-01",
        "countriesvisitedlast3months": "Singapore, Malaysia",
        "previousabnormalscreeningresults": "Blood Test - High Cholesterol",
        "howdidyouhearaboutus": "Relative Referral",
        "agreecontactbyemail": "Yes",
        "signature": "data:image/png;base64,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",
        "date": "2024-05-15",
    }
    try {
        const html = generateHTML("./html/health-history-questionnaire.html", client);
        await generatePDF(html, `health-history-questionnaire`);
        res.status(200).json({ message: 'PDF generated successfully' });
    } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).json({ message: 'Error generating PDF', error: error.message });
    }
});


app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Server is running' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📍 Access at: http://YOUR_EC2_PUBLIC_IP:${PORT}`);
});


