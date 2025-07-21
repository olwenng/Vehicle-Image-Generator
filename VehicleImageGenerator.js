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
        with no people and no text.`;
    }

    async testConnections() {
        try {
            console.log(' Testing connections...');
            
            const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'OPENAI_API_KEY'];
            const missingVars = requiredVars.filter(varName => !process.env[varName]);
            
            if (missingVars.length > 0) {
                console.error(` Missing environment variables: ${missingVars.join(', ')}`);
                return false;
            }

            await this.supabase.from('vehicle').select('*', { count: 'exact' }).limit(1);
            await this.openai.models.list();
            
            console.log(' All connections successful!');
            return true;
        } catch (error) {
            console.error(' Connection failed:', error);
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
    async updateVehicleImage(vehicleId, imageUrl, forceUpdate = false) {
        try {
            // Check if vehicle exists and has existing image
            const { data: current } = await this.supabase
                .from('vehicle')
                .select('vehicletype, vehiclegraphic')
                .eq('id', vehicleId)
                .single();

            if (!current) throw new Error(`Vehicle ID ${vehicleId} not found`);

            if (current.vehiclegraphic && !forceUpdate) {
                console.log(` Vehicle "${current.vehicletype}" already has an image. Use forceUpdate=true to override.`);
                return false;
            }

            // Update the record
            const { error } = await this.supabase
                .from('vehicle')
                .update({ 
                    vehiclegraphic: imageUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', vehicleId);

            if (error) throw error;

            const action = current.vehiclegraphic ? 'Updated' : 'Added';
            console.log(` ${action} image for: ${current.vehicletype}`);
            return true;
        } catch (error) {
            console.error(`Error updating vehicle ${vehicleId}:`, error);
            throw error;
        }
    }

    // Main processing method - handles both missing and existing images
    async processVehicles(onlyMissing = true) {
        if (!(await this.testConnections())) return;

        const vehicles = onlyMissing ? await this.getVehiclesWithoutImages() : await this.getAllVehicles();
        const action = onlyMissing ? 'without images' : 'for regeneration';
        
        console.log(` Found ${vehicles.length} vehicles ${action}`);

        if (vehicles.length === 0) {
            console.log(onlyMissing ? ' All vehicles already have images!' : ' No vehicles found');
            return;
        }

        for (let i = 0; i < vehicles.length; i++) {
            const vehicle = vehicles[i];
            try {
                console.log(`\n[${i + 1}/${vehicles.length}] Processing: ${vehicle.vehicletype}`);
                
                const imageUrl = await this.generateVehicleImage(vehicle.vehicletype);
                await this.updateVehicleImage(vehicle.id, imageUrl, !onlyMissing);
                
                // Rate limiting delay
                if (i < vehicles.length - 1) {
                    console.log(' Waiting 2 seconds...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            } catch (error) {
                console.error(` Failed to process ${vehicle.vehicletype}:`, error);
            }
        }
        
        const completionMsg = onlyMissing ? 'missing images processed' : 'images regenerated';
        console.log(`\n All ${completionMsg}!`);
    }

    // Convenience methods
    async processOnlyMissingImages() {
        return await this.processVehicles(true);
    }

    async regenerateAllImages() {
        return await this.processVehicles(false);
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
        const vehiclesWithoutImages = await generator.getVehiclesWithoutImages();
        
        if (vehiclesWithoutImages.length > 0) {
            // Process only vehicles without images
            await generator.processOnlyMissingImages();
        } else {
            // All vehicles have images, regenerate them
            console.log('All vehicles have images. Regenerating all...');
            await generator.regenerateAllImages();
        }
        
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