import { StyleSheet, Platform } from 'react-native'

export default StyleSheet.create({
  title: { fontSize: 26, fontWeight: 'bold', color: 'black' },
  subtitle: { fontSize: 20, fontWeight: '500', paddingVertical: 3, color: '#333' },
  body: { paddingVertical: 5, color: '#333' },
  button: Platform.select({ android: { marginHorizontal: 12, marginBottom: 15 } }),
  listItem: {
    backgroundColor: '#f0f0f0',
    height: Platform.select({ android: 56, ios: 44 }),
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginTop: -1,
    borderColor: '#ddd',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  listItemTitle: { flex: 1 },
  listItemCounter: { width: 30, textAlign: 'right' },
  post: { padding: 7 },
  topPadding: { paddingTop: 15 },
  comment: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    paddingVertical: 15,
    marginVertical: 5,
    borderRadius: 10,
    borderColor: '#e0e0e0',
    borderWidth: 1,
  },
})
