import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { cloudinary } from '../config/cloudinary';

export const getUploadSignature = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { folder = 'moneysaver' } = req.body;
    const timestamp = Math.round(new Date().getTime() / 1000);

    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    if (!apiSecret || !apiKey || !cloudName) {
      // In development / testing without cloudinary credentials, provide mock config
      res.status(200).json({
        signature: 'mock_signature',
        timestamp,
        apiKey: apiKey || 'mock_key',
        cloudName: cloudName || 'mock_cloud',
        folder: `moneysaver/${folder}`,
        mock: true
      });
      return;
    }

    const paramsToSign = {
      folder: `moneysaver/${folder}`,
      timestamp
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    res.status(200).json({
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder: `moneysaver/${folder}`
    });
  } catch (error) {
    console.error('getUploadSignature error:', error);
    res.status(500).json({ error: 'Failed to generate upload signature' });
  }
};
