import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { X, Star, MessageSquare } from 'lucide-react-native';
import { Fonts } from '@/constants/fonts';

type Rating = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles: {
    full_name: string;
  };
};

type RatingsListModalProps = {
  visible: boolean;
  onClose: () => void;
  ratings: Rating[];
  averageRating: number;
};

export default function RatingsListModal({
  visible,
  onClose,
  ratings,
  averageRating,
}: RatingsListModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>All Ratings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.averageRatingNumber}>
              {averageRating.toFixed(1)}
            </Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={20}
                  color="#fbbf24"
                  fill={star <= Math.round(averageRating) ? '#fbbf24' : 'transparent'}
                />
              ))}
            </View>
            <Text style={styles.ratingsCount}>
              {ratings.length} {ratings.length === 1 ? 'rating' : 'ratings'}
            </Text>
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.ratingsList}>
              {ratings.map((rating) => (
                <View key={rating.id} style={styles.ratingCard}>
                  <View style={styles.ratingHeader}>
                    <View style={styles.ratingStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={14}
                          color="#fbbf24"
                          fill={star <= rating.rating ? '#fbbf24' : 'transparent'}
                        />
                      ))}
                    </View>
                    <Text style={styles.ratingDate}>
                      {new Date(rating.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>

                  <Text style={styles.ratingCustomer}>
                    {rating.profiles?.full_name || 'Anonymous Customer'}
                  </Text>

                  {rating.comment && (
                    <View style={styles.commentContainer}>
                      <MessageSquare size={14} color="#6b7280" />
                      <Text style={styles.ratingComment}>{rating.comment}</Text>
                    </View>
                  )}
                </View>
              ))}
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
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxWidth: 600,
    height: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontFamily: Fonts.poppinsBold,
    color: '#1A1A1A',
  },
  closeButton: {
    padding: 4,
  },
  summaryCard: {
    backgroundColor: '#fffbeb',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#fef3c7',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  averageRatingNumber: {
    fontSize: 48,
    fontFamily: Fonts.poppinsBold,
    color: '#f59e0b',
    marginBottom: 8,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  ratingsCount: {
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
  },
  scrollView: {
    flex: 1,
  },
  ratingsList: {
    padding: 20,
    gap: 12,
  },
  ratingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingDate: {
    fontSize: 12,
    fontFamily: Fonts.poppinsRegular,
    color: '#9ca3af',
  },
  ratingCustomer: {
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#374151',
    marginBottom: 8,
  },
  commentContainer: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  ratingComment: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
    lineHeight: 20,
  },
});
