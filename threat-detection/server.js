const express = require('express');
const bodyParser = require('body-parser');
const kafka = require('kafka-node');

const app = express();

const PORT = process.env.PORT || 3000;
app.use(bodyParser.json());

const { body, validationResult } = require('express-validator');


// Kafka setup
const client = new kafka.KafkaClient({ kafkaHost: process.env.KAFKA_HOST || 'localhost:9092' });
const producer = new kafka.Producer(client);

producer.on('ready', () => {
    console.log('Kafka Producer is ready');
});

producer.on('error', (err) => {
    console.error('Error in Kafka Producer:', err);
});


// In-memory store for threats

const threats = {}; // Store threats by ID
let nextId = 1;     // ID generator


// Creating a threat
app.post('/threats', [
    body('type').isString().withMessage('Type must be a string'),
    body('severity').isIn(['Low', 'Medium', 'High']).withMessage('Severity must be Low, Medium, or High'),
    body('details').isString().withMessage('Details must be a string'),
    body('ip').isIP().withMessage('IP must be a valid IP address'),
    body('area').isString().withMessage('Area must be a string'),
], (req, res) => {

    // Check if any validation errors occur
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    const incomingData = req.body;
    const message = JSON.stringify(incomingData);
    const payloads = [{ topic: 'threats', messages: message }];

    // Store the threat in the in-memory store
    const threatId = nextId++;
    threats[threatId] = { id: threatId, ...incomingData };

    // Sending the detected threat to Kafka
    producer.send(payloads, (err, data) => {
        if (err) {
            console.error('Error sending message to Kafka:', err);
            return res.status(500).json({ message: 'Error sending threat to Kafka' });
        }
        console.log('Threat sent to Kafka:', data);
        return res.status(201).json({ message: 'Threat detected and sent to Kafka', threat: threats[threatId] });
    });

});


// Middleware for error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ message: 'Internal server error' });
});

// Get all threats
app.get('/threats', (req, res) => {
    res.json(Object.values(threats));
});

// Get a specific threat by ID
app.get('/threats/:id', (req, res) => {
    const { id } = req.params;
    const threat = threats[id];
    
    if (threat) {
        res.json(threat);
    } else {
        res.status(404).json({ message: 'Threat not found' });
    }
});


// Update a threat
app.put('/threats/:id', [
    body('type').optional().isString().withMessage('Type must be a string'),
    body('severity').optional().isIn(['Low', 'Medium', 'High']).withMessage('Severity must be Low, Medium, or High'),
    body('details').optional().isString().withMessage('Details must be a string'),
    body('ip').optional().isIP().withMessage('IP must be a valid IP address'),
    body('area').optional().isString().withMessage('Area must be a string'),
], (req, res) => {
    const { id } = req.params;
    const threat = threats[id];

    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    if (threat) {
        // Update the threat with the new data
        threats[id] = { ...threat, ...req.body };
        res.json({ message: 'Threat updated successfully', threat: threats[id] });
    } else {
        res.status(404).json({ message: 'Threat not found' });
    }
});


// Delete a threat
app.delete('/threats/:id', (req, res) => {
    const { id } = req.params;
    
    if (threats[id]) {
        delete threats[id];
        res.status(200).send({message: 'Threat deleted successfully'} ); 
    } else {
        res.status(404).json({ message: 'Threat not found' });
    }
});

// Health-check endpoint
app.get('/', (req, res) => {
    res.send('Threat Detection Service is running');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
