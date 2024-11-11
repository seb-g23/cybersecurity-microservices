const express = require('express');
const bodyParser = require('body-parser');
const kafka = require('kafka-node');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(bodyParser.json());

const { body, validationResult } = require('express-validator');

// Kafka setup
const kafkaHost = process.env.KAFKA_HOST || 'localhost:9092';
const client = new kafka.KafkaClient({ kafkaHost });
const admin = new kafka.Admin(client);
const producer = new kafka.Producer(client);

// Create a threats topic to avoid errors when launching Kafka
admin.createTopics([{ topic: 'threats', partitions: 1, replicationFactor: 1 }], (error, result) => {
    if (error) console.error('Error creating topics:', error);
    else console.log('Topics created or already exist:', result);
});

// In-memory store for incidents
const incidents = {};
let nextId = 1;

// Kafka setup for consuming messages
const consumer = new kafka.Consumer(
    client,
    [{ topic: 'threats', partition: 0 }],
    { autoCommit: true }
);

// Function to send incidents to Kafka
function sendIncidentToKafka(incident, retries = 3) {
    producer.send([{ topic: 'incidents', messages: JSON.stringify(incident) }], (error) => {
        if (error && retries > 0) {
            console.error('Error sending to Kafka, retrying...', error);
            setTimeout(() => sendIncidentToKafka(incident, retries - 1), 1000);
        } else if (error) {
            console.error('Failed to send incident to Kafka:', error);
        } else {
            console.log('Incident published to incidents topic');
        }
    });
}

// Consumer for handling incoming threat messages
consumer.on('message', (message) => {
    
    let threatData;
    try {
        threatData = JSON.parse(message.value);
    } catch (error) {
        console.error('Error parsing Kafka message:', error);
        return;
    }

    const incident = {
        id: nextId++,
        type: threatData.type,
        severity: threatData.severity,
        details: threatData.details,
        ip_address: threatData.ip,
        affected_area: threatData.area,
        status: 'Open',
        createdAt: new Date(),
        updatedAt: new Date()
    };
    incidents[incident.id] = incident;
    console.log('Incident logged:', incident);

    sendIncidentToKafka(incident);
    
    // Simulate notification for high-severity incidents
    if (incident.severity === "High")  console.log('*** ALERT: High-severity incident requires immediate attention! ***');
});

// Middleware for error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ message: 'Internal server error' });
});

// Endpoint to create a new incident manually
app.post('/incidents', [
    body('type').isString().withMessage('Type must be a string'),
    body('severity').isIn(['Low', 'Medium', 'High']).withMessage('Severity must be Low, Medium, or High'),
    body('details').isString().withMessage('Details must be a string'),
    body('ip').isIP().withMessage('IP must be a valid IP address'),
    body('area').isString().withMessage('Area must be a string'),
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {type, severity, details, ip, area } = req.body;
    const incident = {
        id: nextId++,
        type,
        severity,
        details,
        ip_address: ip,
        affected_area: area,
        status: 'Open',
        createdAt: new Date(),
        updatedAt: new Date()
    };
    incidents[incident.id] = incident;

    if (severity === "High" || severity === "Medium") sendIncidentToKafka(incident);
    res.status(201).json(incident);
});

// Endpoint to get all incidents
app.get('/incidents', (req, res) => {
    res.status(200).json(Object.values(incidents));
});

// Endpoint to get a specific incident by ID
app.get('/incidents/:id', (req, res) => {
    const incident = incidents[req.params.id];
    if (!incident) return res.status(404).json({ message: 'Incident not found' });
    res.status(200).json(incident);
});

// Endpoint to update an incident by ID
app.put('/incidents/:id', [
    body('type').optional().isString().withMessage('Type must be a string'),
    body('severity').optional().isIn(['Low', 'Medium', 'High']).withMessage('Severity must be Low, Medium, or High'),
    body('details').optional().isString().withMessage('Details must be a string'),
    body('ip').optional().isIP().withMessage('IP must be a valid IP address'),
    body('area').optional().isString().withMessage('Area must be a string'),
], (req, res) => {
    const incident = incidents[req.params.id];
    if (!incident) return res.status(404).json({ message: 'Incident not found' });

    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { severity, details, ip, area, status } = req.body;
    incidents[req.params.id] = {
        ...incident,
        severity: severity || incident.severity,
        details: details || incident.details,
        ip_address: ip || incident.ip_address,
        affected_area: area || incident.affected_area,
        status: status || incident.status,
        updatedAt: new Date()
    };
    res.status(200).json(incidents[req.params.id]);
});

// Endpoint to delete an incident by ID
app.delete('/incidents/:id', (req, res) => {
    const incident = incidents[req.params.id];
    if (!incident) return res.status(404).json({ message: 'Incident not found' });

    delete incidents[req.params.id];
    res.status(200).json({ message: 'Incident deleted successfully' });
});

// Health-check endpoint
app.get('/', (req, res) => {
    res.send('Incident Management Service is running');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
