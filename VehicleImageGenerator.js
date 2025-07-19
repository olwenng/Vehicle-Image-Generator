require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

class VehicleImageGenerator {
    constructor() {
        this.supabase = supabase;
        this.openai = openai;
    }

    // Generate photo-realistic vehicle image prompt
    generateImagePrompt(vehicletype) {
        return `A photo-realistic, ultra-detailed image of a ${vehicletype} in pristine condition, 
        captured at a 3/4 front angle on a sleek, modern showroom floor with professional lighting. 
        The flawless paint reflects perfectly, showcasing chrome accents and tire details. The 
        background features a soft gray-to-white gradient for depth. High-resolution, showroom-quality, 
        with no people, text, or logos aside from the manufacturer's badges.`;
    }

    // Test environment variables
    async testEnvironmentVariables() {
        console.log(' Checking environment variables...');
        const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'OPENAI_API_KEY'];
        let allFound = true;
    
        for (const varName of requiredVars) {
            if (process.env[varName]) {
                console.log(`   ${varName}: Found`);
            } else {
                console.log(`   ${varName}: Missing`);
                allFound = false;
            }
        }
    
        if (!allFound) {
            console.log('\n Please check your .env file and ensure all required variables are set.');
        }
    
        return allFound;
    }

    // Test database connection
    async testConnection() {
        try {
            console.log(' Testing database connection...');
            const { data, error, count } = await this.supabase
                .from('vehicle')
                .select('*', { count: 'exact' })
                .limit(1);
            
            if (error) throw error;
            console.log(' Database connection successful!');
            console.log(` Found ${count || 0} vehicle(s) in database`);
            return true;
        } catch (error) {
            console.error(' Database connection failed:', error);
            return false;
        }
    }

    // Test OpenAI connection
    async testOpenAIConnection() {
        try {
            console.log(' Testing OpenAI connection...');
            const response = await this.openai.models.list();
            console.log(' OpenAI connection successful!');
            return true;
        } catch (error) {
            console.error(' OpenAI connection failed:', error);
            return false;
        }
    }

    // Generate image using OpenAI DALL-E
    async generateVehicleImage(vehicletype) {
        try {
            console.log(` Generating image for: ${vehicletype}`);
            
            const response = await this.openai.images.generate({
                model: "dall-e-3",
                prompt: this.generateImagePrompt(vehicletype),
                size: "1024x1024",
                quality: "hd",
                style: "vivid",
                n: 1,
            });

            console.log(` Image generated successfully for: ${vehicletype}`);
            return response.data[0].url;
        } catch (error) {
            console.error(` Error generating image for ${vehicletype}:`, error);
            throw error;
        }
    }

    // Update vehicle record with generated image URL
    async updateVehicleImage(vehicleId, imageUrl) {
        try {
            const { data, error } = await this.supabase
                .from('vehicle')
                .update({ 
                    vehiclegraphic: imageUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', vehicleId)
                .select();

            if (error) throw error;
            console.log(` Database updated for vehicle ID: ${vehicleId}`);
            return data;
        } catch (error) {
            console.error(` Error updating vehicle ${vehicleId}:`, error);
            throw error;
        }
    }

    // Get all vehicle without images
    async getVehiclesWithoutImages() {
        try {
            const { data, error } = await this.supabase
                .from('vehicle')
                .select('*')
                .is('vehiclegraphic', null);

            if (error) throw error;
            return data;
        } catch (error) {
            console.error(' Error fetching vehicle:', error);
            throw error;
        }
    }

    // Process all vehicle
    async processAllVehicles() {
        try {
            console.log(' Starting vehicle processing...');
            // Test environment variables first
            const envOk = await this.testEnvironmentVariables();
            if (!envOk) {
                console.error(' Environment variable check failed.');
                return;
            }
            // Test connections
            const dbOk = await this.testConnection();
            const openaiOk = await this.testOpenAIConnection();
            
            if (!dbOk || !openaiOk) {
                console.error(' Connection tests failed. Please check your .env file.');
                return;
            }

            const vehicles = await this.getVehiclesWithoutImages();
            console.log(` Found ${vehicles.length} vehicle to process`);

            if (vehicles.length === 0) {
                console.log(' All vehicle already have images!');
                return;
            }

            for (let i = 0; i < vehicles.length; i++) {
                const vehicle = vehicles[i];
                try {
                    console.log(`\n[${i + 1}/${vehicles.length}] Processing: ${vehicle.vehicletype}`);
                    
                    // Generate image
                    const imageUrl = await this.generateVehicleImage(vehicle.vehicletype);
                    
                    // Update database
                    await this.updateVehicleImage(vehicle.id, imageUrl);
                    
                    console.log(` Successfully processed: ${vehicle.vehicletype}`);
                    
                    // Add delay to respect rate limits (2 seconds between requests)
                    if (i < vehicles.length - 1) {
                        console.log(' Waiting 2 seconds before next request...');
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    
                } catch (error) {
                    console.error(` Failed to process ${vehicle.vehicletype}:`, error);
                    continue;
                }
            }

            console.log('\n All vehicle processed!');
        } catch (error) {
            console.error('Error in processAllVehicles:', error);
        }
    }

    // Get all vehicle with images
    async getAllVehicles() {
        try {
            const { data, error } = await this.supabase
                .from('vehicle')
                .select('*')
                .order('id', { ascending: true });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching all vehicle:', error);
            throw error;
        }
    }

    // Display results
    async displayResults() {
        try {
            const allVehicles = await this.getAllVehicles();
            console.log('\n Final Results:');
            console.log('=====================================');
            
            allVehicles.forEach(vehicle => {
                const status = vehicle.vehiclegraphic ? 'Generated' : 'Missing';
                console.log(`${vehicle.id}. ${vehicle.vehicletype}`);
                console.log(`   Image: ${status}`);
                if (vehicle.vehiclegraphic) {
                    console.log(`   URL: ${vehicle.vehiclegraphic}`);
                }
                console.log('');
            });
        } catch (error) {
            console.error('Error displaying results:', error);
        }
    }
}

// Main execution function
async function main() {
    console.log('Vehicle Image Generator Starting...');
    console.log('=====================================\n');
    
    const generator = new VehicleImageGenerator();
    
    try {
        // Process all vehicle without images
        await generator.processAllVehicles();
        
        // Display final results
        await generator.displayResults();
        
    } catch (error) {
        console.error('Error in main process:', error);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = VehicleImageGenerator;