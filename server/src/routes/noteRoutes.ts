import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { requireNoteAccess, requireOwner } from '../middleware/accessControl';
import { validate } from '../middleware/validate';
import {
  createNote,
  deleteNote,
  getCollaborators,
  getHistory,
  getNote,
  getNotes,
  getTags,
  getTrash,
  getVersion,
  permanentDelete,
  removeCollaborator,
  restoreFromTrash,
  restoreVersion,
  searchNotes,
  shareNote,
  updateNote,
} from '../controllers/noteController';

const router = Router();

// All note routes require authentication.
router.use(authenticate);

const hexColor = body('color')
  .optional()
  .matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  .withMessage('Color must be a valid hex code');

// Collection-level routes (declare static paths before :id).
router.get('/', getNotes);
router.get('/search', searchNotes);
router.get('/tags', getTags);
router.get('/trash', getTrash);

router.post(
  '/',
  [
    body('title').optional().isString().isLength({ max: 200 }),
    body('content').optional().isString(),
    body('tags').optional().isArray(),
    hexColor,
    body('isPinned').optional().isBoolean(),
  ],
  validate,
  createNote
);

// Single-note routes.
router.get('/:id', requireNoteAccess('read'), getNote);

router.put(
  '/:id',
  [
    body('title').optional().isString().isLength({ max: 200 }),
    body('content').optional().isString(),
    body('tags').optional().isArray(),
    hexColor,
    body('isPinned').optional().isBoolean(),
  ],
  validate,
  requireNoteAccess('write'),
  updateNote
);

router.delete('/:id', requireNoteAccess('write'), deleteNote);
router.post('/:id/restore-trash', restoreFromTrash);
router.delete('/:id/permanent', requireOwner(), permanentDelete);

// Versioning.
router.get('/:id/history', requireNoteAccess('read'), getHistory);
router.get(
  '/:id/history/:versionNumber',
  [param('versionNumber').isInt({ min: 1 })],
  validate,
  requireNoteAccess('read'),
  getVersion
);
router.post(
  '/:id/restore/:versionNumber',
  [param('versionNumber').isInt({ min: 1 })],
  validate,
  requireNoteAccess('write'),
  restoreVersion
);

// Sharing / collaborators.
router.get('/:id/collaborators', requireNoteAccess('read'), getCollaborators);
router.post(
  '/:id/share',
  [body('email').isEmail().normalizeEmail(), body('permission').optional().isIn(['read', 'write'])],
  validate,
  requireOwner(),
  shareNote
);
router.delete('/:id/share/:userId', requireOwner(), removeCollaborator);

export default router;
