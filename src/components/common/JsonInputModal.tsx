import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Typography,
  Box,
} from '@mui/material';

interface JsonInputModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  title: string;
  description: string;
  sampleJson?: string;
}

export default function JsonInputModal({
  open,
  onClose,
  onSubmit,
  title,
  description,
  sampleJson,
}: JsonInputModalProps) {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setError('');
      onSubmit(parsed);
      setJsonText('');
      onClose();
    } catch (e) {
      setError('Invalid JSON format. Please check and try again.');
    }
  };

  const handleLoadSample = () => {
    if (sampleJson) {
      setJsonText(sampleJson);
      setError('');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          multiline
          rows={15}
          fullWidth
          variant="outlined"
          placeholder="Paste JSON here..."
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            setError('');
          }}
          sx={{
            '& .MuiInputBase-input': {
              fontFamily: 'monospace',
              fontSize: '0.85rem',
            },
          }}
        />
        {sampleJson && (
          <Box sx={{ mt: 1 }}>
            <Button size="small" onClick={handleLoadSample}>
              Load Sample Data
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!jsonText.trim()}>
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
}

