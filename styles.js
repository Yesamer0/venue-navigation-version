import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F5' },
  header: { padding: 20, paddingTop: 40 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#D8A7B1' },
  list: { padding: 20 },
  card: { 
    backgroundColor: '#fff', 
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
  priceText: { color: '#D8A7B1', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  venueLocation: { fontSize: 14, color: '#888', flex: 1 },
  ratingBadge: { 
    backgroundColor: 'rgba(216, 167, 177, 0.1)', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8A7B1',
    marginLeft: 10
  },
  ratingText: { fontWeight: 'bold', color: '#D8A7B1', fontSize: 12 },
  categoryBadge: { 
    position: 'absolute', 
    top: 10, 
    left: 10, 
    backgroundColor: 'rgba(255, 245, 245, 0.9)', 
    paddingHorizontal: 12, 
    paddingVertical: 4, 
    borderRadius: 15, 
    borderWidth: 1, 
    borderColor: '#D8A7B1',
    zIndex: 1
  },
  categoryBadgeText: { color: '#D8A7B1', fontSize: 11, fontWeight: 'bold' },
  categoryContainer: { paddingVertical: 10, paddingLeft: 20 },
  categoryButton: { 
    paddingHorizontal: 20, 
    paddingVertical: 10, 
    borderRadius: 20, 
    backgroundColor: '#fff', 
    marginRight: 10, 
    borderWidth: 1, 
    borderColor: '#D8A7B1' 
  },
  selectedCategoryButton: { backgroundColor: '#D8A7B1' },
  categoryText: { color: '#D8A7B1', fontWeight: '600' },
  selectedCategoryText: { color: '#fff' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#D8A7B1', textAlign: 'center' },
  allButton: { 
    marginTop: 20, 
    backgroundColor: '#D8A7B1', 
    paddingHorizontal: 25, 
    paddingVertical: 12, 
    borderRadius: 25 
  },
  allButtonText: { color: '#fff', fontWeight: 'bold' }
});