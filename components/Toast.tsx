import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react-native';
import { Fonts } from '@/constants/fonts';

type ToastType = 'success' | 'error' | 'info' | 'warning';

type ToastProps = {
  message: string;
  type?: ToastType;
  duration?: number;
  visible: boolean;
  onDismiss: () => void;
};

export function Toast({ message, type = 'success', duration = 5000, visible, onDismiss }: ToastProps) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      if (duration > 0) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, duration);

        return () => clearTimeout(timer);
      }
    } else {
      handleDismiss();
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!visible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={20} color="#16a34a" />;
      case 'error':
        return <AlertCircle size={20} color="#dc2626" />;
      case 'warning':
        return <AlertTriangle size={20} color="#f59e0b" />;
      case 'info':
      default:
        return <Info size={20} color="#3b82f6" />;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return '#dcfce7';
      case 'error':
        return '#fee2e2';
      case 'warning':
        return '#fef3c7';
      case 'info':
      default:
        return '#dbeafe';
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return '#16a34a';
      case 'error':
        return '#dc2626';
      case 'warning':
        return '#f59e0b';
      case 'info':
      default:
        return '#3b82f6';
    }
  };

  const getTextColor = () => {
    switch (type) {
      case 'success':
        return '#166534';
      case 'error':
        return '#991b1b';
      case 'warning':
        return '#92400e';
      case 'info':
      default:
        return '#1e40af';
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          backgroundColor: getBackgroundColor(),
          borderLeftColor: getBorderColor(),
        },
      ]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>{getIcon()}</View>
        <Text style={[styles.message, { color: getTextColor() }]}>{message}</Text>
        <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
          <X size={18} color={getTextColor()} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    maxWidth: 600,
    alignSelf: 'center',
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
  },
  iconContainer: {
    paddingTop: 2,
  },
  message: {
    fontFamily: Fonts.medium,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  closeButton: {
    padding: 4,
  },
});
