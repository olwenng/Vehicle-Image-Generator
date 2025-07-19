# Service Stories Practice Task: Vehicle Image Generator 

## Introduction:

This project sets up a Supabase instance to store a list of 15 vehicles. It creates a table with vehicle info, uses the OpenAI API to generate photo-realistic images based on the vehicle type, and saves those images back to Supabase.

## Prerequisites

Node.js (version 12 or higher)
Supabase account (free plan)
OpenAI API account with credits (I added $5 to my account to use the image generation feature)

## How to run the project

### 1. Navigate to the project directory:

cd Vehicle-Image-Generator

### 2. Install dependencies:

npm install

### 3. Run the application:

node VehicleImageGenerator.js

Note: The .env file in this project already includes my Supabase and OpenAI API keys, and the vehiclegraphic field in the database is already populated with AI-generated image links.

If you want to test this yourself, you can replace the keys in .env with your own, make sure your vehiclegraphic column is still empty, and run the script to generate images.

