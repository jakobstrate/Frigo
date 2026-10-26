import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

type FrigoLogoIconProps = {
  size?: number;
};

type FrigoLogoProps = FrigoLogoIconProps & {
  tone?: 'dark' | 'light';
  style?: StyleProp<ViewStyle>;
};

export function FrigoLogoIcon({ size = 36 }: FrigoLogoIconProps) {
  return (
    <Image
      accessible={false}
      contentFit="contain"
      source={require('@/assets/images/frigo-mark.png')}
      style={{ width: size, height: size }}
    />
  );
}

export function FrigoLogo({ size = 36, tone = 'dark', style }: FrigoLogoProps) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="FriGo"
      style={[styles.lockup, { gap: size * 0.24 }, style]}>
      <FrigoLogoIcon size={size} />
      <Text accessible={false} style={[styles.wordmark, { color: tone === 'light' ? '#fff' : '#19251F', fontSize: size * 0.62 }]}>
        FriGo
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center' },
  wordmark: { fontWeight: '700' },
});