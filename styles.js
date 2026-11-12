import { StyleSheet } from 'react-native';
import { palette } from './theme';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },
  header: { padding: 20, paddingTop: 40 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: palette.accent },
  list: { padding: 20 },
  card: { 
    backgroundColor: palette.surface,
    borderRadius: 20, 
    marginBottom: 20, 
    overflow: 'hidden', 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 10 
  },
  image: { width: '100%', height: 180 },
  cardContent: { padding: 15 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5
  },
  venueName: { fontSize: 18, fontWeight: 'bold', color: '#444', flex: 1 },
  priceText: { color: palette.accent, fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  venueLocation: { fontSize: 14, color: '#888', flex: 1 },
  ratingBadge: { 
    backgroundColor: 'rgba(216, 167, 177, 0.1)', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.accent,
    marginLeft: 10
  },
  ratingText: { fontWeight: 'bold', color: palette.accent, fontSize: 12 },
  categoryBadge: { 
    position: 'absolute', 
    top: 10, 
    left: 10, 
    backgroundColor: 'rgba(255, 245, 245, 0.9)', 
    paddingHorizontal: 12, 
    paddingVertical: 4, 
    borderRadius: 15, 
    borderWidth: 1, 
    borderColor: palette.accent,
    zIndex: 1
  },
  categoryBadgeText: { color: palette.accent, fontSize: 11, fontWeight: 'bold' },
  categoryContainer: { paddingVertical: 10, paddingLeft: 20 },
  categoryButton: { 
    paddingHorizontal: 20, 
    paddingVertical: 10, 
    borderRadius: 20, 
    backgroundColor: palette.surface,
    marginRight: 10, 
    borderWidth: 1, 
    borderColor: palette.accent
  },
  selectedCategoryButton: { backgroundColor: palette.accent },
  categoryText: { color: palette.accent, fontWeight: '600' },
  selectedCategoryText: { color: palette.surface },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: palette.accent, textAlign: 'center' },
  allButton: { 
    marginTop: 20, 
    backgroundColor: palette.accent,
    paddingHorizontal: 25, 
    paddingVertical: 12, 
    borderRadius: 25 
  },
  allButtonText: { color: palette.surface, fontWeight: 'bold' }
});