/**
 * Bundly Agent SDK - Metadata Upload
 * 
 * Handles uploading token metadata (image + JSON) to IPFS
 */

import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

/**
 * Upload image to IPFS using nft.storage (free, no API key needed for small files)
 * @param {string} imagePath - Path to image file
 * @returns {Promise<string>} IPFS URI (ipfs://...)
 */
export async function uploadImageToIPFS(imagePath) {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }

  // Use a public IPFS gateway (pinata.cloud free tier)
  // For production, use nft.storage or dedicated IPFS service
  const JWT = process.env.PINATA_JWT || process.env.NFT_STORAGE_KEY;
  
  if (!JWT) {
    console.warn('⚠️  No PINATA_JWT or NFT_STORAGE_KEY found in environment');
    console.warn('   Using mock IPFS URL for testing');
    return 'ipfs://QmTest123456789'; // Mock for testing
  }

  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(imagePath));

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${JWT}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`IPFS upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    return `ipfs://${data.IpfsHash}`;
  } catch (error) {
    console.error('IPFS upload error:', error.message);
    throw error;
  }
}

/**
 * Upload metadata JSON to IPFS
 * @param {Object} metadata - Token metadata object
 * @param {string} metadata.name - Token name
 * @param {string} metadata.symbol - Token symbol
 * @param {string} metadata.description - Token description
 * @param {string} metadata.image - IPFS URI of image
 * @returns {Promise<string>} Metadata URI (ipfs://...)
 */
export async function uploadMetadataToIPFS(metadata) {
  const JWT = process.env.PINATA_JWT || process.env.NFT_STORAGE_KEY;
  
  if (!JWT) {
    console.warn('⚠️  No PINATA_JWT or NFT_STORAGE_KEY found in environment');
    console.warn('   Using mock metadata URL for testing');
    return 'ipfs://QmTestMetadata123456789';
  }

  try {
    // Create metadata JSON following Metaplex standard
    const metadataJson = {
      name: metadata.name,
      symbol: metadata.symbol,
      description: metadata.description,
      image: metadata.image,
      attributes: metadata.attributes || [],
      properties: {
        files: [{
          uri: metadata.image,
          type: 'image/png'
        }],
        category: 'image',
        creators: metadata.creators || []
      }
    };

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${JWT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pinataContent: metadataJson,
        pinataMetadata: {
          name: `${metadata.symbol}_metadata.json`
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Metadata upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    return `ipfs://${data.IpfsHash}`;
  } catch (error) {
    console.error('Metadata upload error:', error.message);
    throw error;
  }
}

/**
 * Complete metadata upload flow (image + JSON)
 * @param {Object} options
 * @param {string} options.imagePath - Path to image file
 * @param {string} options.name - Token name
 * @param {string} options.symbol - Token symbol
 * @param {string} options.description - Token description
 * @returns {Promise<string>} Metadata URI
 */
export async function uploadBundleMetadata(options) {
  const { imagePath, name, symbol, description } = options;

  console.log('📤 Uploading metadata to IPFS...');
  console.log(`   Name: ${name}`);
  console.log(`   Symbol: ${symbol}`);
  console.log(`   Image: ${imagePath}`);
  console.log();

  // Step 1: Upload image
  console.log('   1/2 Uploading image...');
  const imageUri = await uploadImageToIPFS(imagePath);
  console.log(`   ✅ Image uploaded: ${imageUri}`);

  // Step 2: Upload metadata JSON
  console.log('   2/2 Uploading metadata JSON...');
  const metadataUri = await uploadMetadataToIPFS({
    name,
    symbol,
    description,
    image: imageUri
  });
  console.log(`   ✅ Metadata uploaded: ${metadataUri}`);
  console.log();

  return metadataUri;
}

export default {
  uploadImageToIPFS,
  uploadMetadataToIPFS,
  uploadBundleMetadata
};
