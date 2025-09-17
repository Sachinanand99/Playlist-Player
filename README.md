# Playlist Player App

## Overview
The Folder Viewer App is a Node.js and Express application that dynamically reads a folder structure and displays it in a web application. It features a sidebar for navigating modules and files, and provides functionality to play videos and display PDFs.

## Features
- Dynamic folder structure reading
- Sidebar navigation for modules and files
- Video playback functionality
- PDF display capability

## Project Structure
```
folder-viewer-app
├── server.js                 # Main server logic
├── views                    # EJS templates
│   ├── index.ejs            # Main layout
│   ├── set-root.ejs         # Folder selection page
├── public                   # Static assets
│   ├── css
│   │   └── styles.css       # Custom styles
│   └── js
│       └── main.js          # Client-side logic
├── package.json
└── README.md
```

## Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd folder-viewer-app
   ```
3. Install the dependencies:
   ```
   npm install
   ```

## Usage
1. Start the application:
   ```
   npm start
   ```
2. Open your web browser and navigate to `http://localhost:3000`.

## License
This project is licensed under the MIT License.