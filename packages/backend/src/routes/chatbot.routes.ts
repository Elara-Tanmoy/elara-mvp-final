import { Router } from 'express';
import { chatbotController } from '../controllers/chatbot.controller.js';

const router: any = Router();

// Chat endpoints
router.post('/chat', chatbotController.chat.bind(chatbotController));
router.get('/session/:id', chatbotController.getSession.bind(chatbotController));
router.post('/session/end', chatbotController.endSession.bind(chatbotController));

// Configuration endpoints
router.get('/config', chatbotController.getConfig.bind(chatbotController));
router.put('/config', chatbotController.updateConfig.bind(chatbotController));

// Knowledge base endpoints
router.post('/knowledge', chatbotController.addKnowledge.bind(chatbotController));
router.get('/knowledge/search', chatbotController.searchKnowledge.bind(chatbotController));
router.get('/knowledge/stats', chatbotController.getKnowledgeStats.bind(chatbotController));
router.delete('/knowledge/:id', chatbotController.deleteKnowledge.bind(chatbotController));

// Training endpoints
router.post('/training/csv', chatbotController.uploadCSV.bind(chatbotController));
router.post('/training/text', chatbotController.uploadText.bind(chatbotController));
router.post('/training/json', chatbotController.uploadJSON.bind(chatbotController));
router.get('/training/:id', chatbotController.getTrainingStatus.bind(chatbotController));
router.get('/training/history', chatbotController.getTrainingHistory.bind(chatbotController));

// Analytics endpoints
router.get('/analytics', chatbotController.getAnalytics.bind(chatbotController));

export default router;
