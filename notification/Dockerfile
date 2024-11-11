# Use the official Node.js image as a base
FROM node:18 

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to install only necessary dependencies
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy only necessary application files to the container
COPY server.js ./

# Expose the port the app runs on
EXPOSE 3000

# Set an explicit entrypoint and command to start the application
ENTRYPOINT ["node"]
CMD ["server.js"]