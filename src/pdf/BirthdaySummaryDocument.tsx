import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { Category, CategoryKey } from '../types';

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 26,
    paddingBottom: 34,
    backgroundColor: '#ffffff',
    color: '#161616',
    fontSize: 12,
    fontFamily: 'Courier',
  },
  receipt: {
    borderTop: '2 solid #111111',
    borderBottom: '2 solid #111111',
    paddingTop: 12,
    paddingBottom: 14,
  },
  brandBlock: {
    marginBottom: 10,
    alignItems: 'center',
  },
  business: {
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  subline: {
    marginTop: 2,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  purpose: {
    marginTop: 6,
    fontSize: 10,
    textAlign: 'center',
  },
  divider: {
    marginTop: 10,
    marginBottom: 10,
    paddingTop: 7,
    paddingBottom: 7,
    borderTop: '1 solid #111111',
    borderBottom: '1 solid #111111',
  },
  metaRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    fontSize: 10,
  },
  metaLabel: {
    opacity: 0.7,
  },
  sectionTitle: {
    marginTop: 2,
    marginBottom: 6,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  list: {
    display: 'flex',
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 7,
    borderBottom: '1 solid #d7d7d7',
  },
  itemIndex: {
    width: 18,
    fontSize: 11,
  },
  itemBlock: {
    flexGrow: 1,
  },
  rowLabel: {
    marginBottom: 2,
    fontSize: 12,
    fontWeight: 700,
  },
  rowValue: {
    fontSize: 10,
    lineHeight: 1.4,
  },
  totals: {
    marginTop: 10,
    paddingTop: 8,
    borderTop: '1 solid #111111',
    gap: 4,
  },
  totalsRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 10,
  },
  totalsRowStrong: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 12,
    fontWeight: 700,
  },
  footerNote: {
    marginTop: 14,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 1.5,
  },
});

interface BirthdaySummaryDocumentProps {
  categories: Category[];
  selectedGifts: Record<CategoryKey, string | null>;
}

export function BirthdaySummaryDocument({
  categories,
  selectedGifts,
}: BirthdaySummaryDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.receipt}>
          <View style={styles.brandBlock}>
            <Text style={styles.business}>Araba Mansa Sagoe</Text>
            <Text style={styles.subline}>Gift Cashout Receipt</Text>
            <Text style={styles.purpose}>Purpose: Yedi 31 ooo. Yenyin roff.</Text>
          </View>

          <View style={styles.divider}>
            <View style={styles.metaRow}>
              <Text>
                <Text style={styles.metaLabel}>Customer: </Text>
                Bryan Mensah
              </Text>
              <Text>
                <Text style={styles.metaLabel}>Status: </Text>
                Cash Out
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Chosen gifts</Text>
          <View style={styles.list}>
            {categories.map((category, index) => (
              <View key={category.key} style={styles.row}>
                <Text style={styles.itemIndex}>{String(index + 1).padStart(2, '0')}</Text>
                <View style={styles.itemBlock}>
                  <Text style={styles.rowLabel}>{category.title}</Text>
                  <Text style={styles.rowValue}>{selectedGifts[category.key] ?? 'No gift selected'}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.totals}>
            <View style={styles.totalsRow}>
              <Text>Total categories</Text>
              <Text>{categories.length}</Text>
            </View>
            <View style={styles.totalsRowStrong}>
              <Text>Items cashed out</Text>
              <Text>{Object.values(selectedGifts).filter(Boolean).length}</Text>
            </View>
          </View>

          <Text style={styles.footerNote}>Issued by Araba Mansa Sagoe for Bryan Mensah.</Text>
          <Text style={styles.footerNote}>Yedi 31 ooo. Yenyin roff.</Text>
        </View>
      </Page>
    </Document>
  );
}
