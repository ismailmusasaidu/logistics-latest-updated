import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Star } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

type RatingModalProps = {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  riderId: string;
  customerId: string;
  riderName: string;
  onSuccess?: () => void;
};

export default function RatingModal({
  visible,
  onClose,
  orderId,
  riderId,
  customerId,
  riderName,
  onSuccess,
}: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: submitError } = await supabase
        .from('ratings')
        .insert({
          order_id: orderId,
          rider_id: riderId,
          customer_id: customerId,
          rating,
          comment: comment.trim() || null,
        });

      if (submitError) throw submitError;

      setRating(0);
      setComment('');
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Error submitting rating:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setRating(0);
      setComment('');
      setError(null);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Rate Your Delivery</Text>
            <Text style={styles.subtitle}>
              How was your experience with {riderName}?
            </Text>

            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  disabled={loading}
                  style={styles.starButton}
                >
                  <Star
                    size={40}
                    color={star <= rating ? '#FFD700' : '#DDD'}
                    fill={star <= rating ? '#FFD700' : 'transparent'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {rating > 0 && (
              <Text style={styles.ratingText}>
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Below Average'}
                {rating === 3 && 'Average'}
                {rating === 4 && 'Good'}
                {rating === 5 && 'Excellent'}
              </Text>
            )}

            <Text style={styles.label}>Additional Comments (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Share your feedback..."
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!loading}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.submitButton,
                  (loading || rating === 0) && styles.disabledButton,
                ]}
                onPress={handleSubmit}
                disabled={loading || rating === 0}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Rating</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 16,
    minHeight: 100,
  },
  error: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#10B981',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#D1D5DB',
  },
});
