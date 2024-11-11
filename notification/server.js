const express = require('express');
const bodyParser = require('body-parser');
const kafka = require('kafka-node');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3004;

app.use(bodyParser.json());

// Kafka setup
const kafkaHost = process.env.KAFKA_HOST || 'localhost:9092';
const client = new kafka.KafkaClient({ kafkaHost });
const admin = new kafka.Admin(client);

// Create Kafka topics
admin.createTopics([{ topic: 'incidents', partitions: 1, replicationFactor: 1 }], (error, result) => {
    if (error) {
        console.error('Error creating topics:', error);
    } else {
        console.log('Topics created or already exist:', result);
    }
});

const consumer = new kafka.Consumer(
    client,
    [{ topic: 'incidents', partition: 0 }],
    { autoCommit: true }
);

// Email configuration
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS,  
    },
});

// Function to send email notifications
const sendEmailNotification = (incident) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER, // Send to microservices2024@gmail.com
        subject: `Critical Incident Detected: ${incident.incidentType}`,
        text: `A new critical incident has been detected:\n\n${JSON.stringify(incident, null, 2)}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.error('Error sending email:', error);
        }
        console.log('Email sent:', info.response);
    });
};

// Function to handle incidents and send notifications
const handleIncident = (incident) => {
    if (incident.severity === 'High') {
        sendEmailNotification(incident);
    }
};

// Kafka consumer to listen for incidents
consumer.on('message', (message) => {
    console.log('Received incident from Kafka:', message);
    const incident = JSON.parse(message.value); // parse the incident message
    handleIncident(incident);
});

// Middleware for error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ message: 'Internal server error' });
});

// Health check route
app.get('/', (req, res) => {
    res.send('Notification Service is running');
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`Notification Service running on http://localhost:${PORT}`);
});
