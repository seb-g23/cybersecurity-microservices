const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises; //importing the file system module from node.js for file operations
const kafka = require('kafka-node');

const app = express();
const PORT = process.env.PORT || 3003;
const LOG_FILE = './security_logs.json'; //file to log all the events occuring

app.use(bodyParser.json());

// Ensure the log file exists and is empty at the start
(async () => {
    try {
        await fs.writeFile(LOG_FILE, '[]', { flag: 'wx' }); 
    } catch (err) {
        if (err.code !== 'EEXIST') console.error('Error creating log file:', err);
    }
})();

// Kafka setup
const kafkaHost = process.env.KAFKA_HOST || 'localhost:9092';
const client = new kafka.KafkaClient({ kafkaHost });
const admin = new kafka.Admin(client);

// Create a all the topics to avoid any errors when launching Kafka
admin.createTopics([
    { topic: 'threats', partitions: 1, replicationFactor: 1 },
    { topic: 'incidents', partitions: 1, replicationFactor: 1 },
    { topic: 'responses', partitions: 1, replicationFactor: 1 }
], (error, result) => {
    if (error) console.error('Error creating topics:', error);
    else console.log('Topics created or already exist:', result);
});

// Kafka setup for consuming messages from the threat-detection, incident-management and response services
const consumer = new kafka.Consumer(
    client,
    [{ topic: 'threats', partition: 0 }, { topic: 'incidents', partition: 0 }, { topic: 'responses', partition: 0 }],
    { autoCommit: true }
);

// Function to log events in an immutable, append-only file
const logEvent = async (event) => {
    try {
        const logs = JSON.parse(await fs.readFile(LOG_FILE, 'utf8'));
        logs.push({
            ...event,
            timestamp: new Date().toISOString(),
        });
        await fs.writeFile(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
    } catch (err) {
        console.error('Error logging event:', err);
    }
};

// Process incoming Kafka messages and log them
consumer.on('message', (message) => {
    console.log(`Logging event from Kafka topic: ${message.topic}`);
    const event = JSON.parse(message.value);
    logEvent({ topic: message.topic, ...event });
});

consumer.on('error', (error) => {
    console.error('Error in Kafka Consumer:', error);
});

// Middleware for error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ message: 'Internal server error' });
});

// Endpoint to retrieve all logs
app.get('/logs', async (req, res) => {
    try {
        const logs = JSON.parse(await fs.readFile(LOG_FILE, 'utf8'));
        res.json(logs);
    } catch (err) {
        console.error('Error reading log file:', err);
        res.status(500).json({ error: 'Failed to retrieve logs' });
    }
});

// Health-check endpoint
app.get('/', (req, res) => {
    res.send('Centralized Logging Service is running');
});

app.listen(PORT, () => {
    console.log(`Logging Service running on http://localhost:${PORT}`);
});
