import { StyleSheet } from 'react-native';

export const makeStyles = colors => StyleSheet.create({
  browser: {
    flex: 1,
    minHeight: 0,
    gap: 16,
  },
  search: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 12,
    paddingBottom: 16,
  },
  card: {
    minHeight: 82,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  cardInfo: {
    flex: 1,
    gap: 8,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  chevron: {
    color: colors.accent,
    fontSize: 25,
  },
  text: {
    color: colors.text,
    fontSize: 14,
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  empty: {
    paddingVertical: 24,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 21,
  },
  feedback: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 14,
  },
  error: {
    color: colors.error,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.75,
  },

  modalRoot: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  dialog: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '85%',
    padding: 4,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.dialogBackground,
  },
  dialogInner: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.dialogBackground,
  },
  pickerDialogInner: {
    flex: 1,
    minHeight: 0,
  },
  pickerDialog: {
    height: '80%',
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  dialogTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 23,
    fontWeight: '700',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors.muted,
    fontSize: 29,
  },
  details: {
    flexGrow: 0,
  },
  detailsContent: {
    gap: 20,
  },
  results: {
    padding: 16,
    gap: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  resultsTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  correct: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  dialogActions: {
    gap: 10,
  },
  secondaryButton: {
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  primaryText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.65,
  },
});