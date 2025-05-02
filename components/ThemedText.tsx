import { Text, TextProps, StyleSheet } from 'react-native';

export function ThemedText({ style, type = 'default', ...rest }: TextProps & { type?: 'default' | 'title' | 'link' }) {
  return (
    <Text
      style={[
        type === 'default' ? styles.default : type === 'title' ? styles.title : styles.link,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    color: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  link: {
    fontSize: 16,
    color: '#1e90ff',
  },
});