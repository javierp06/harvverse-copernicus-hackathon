type FarmImageStorageRecord = {
  data: string | null;
  mimeType: string;
};

export async function getFarmImageUrl(image: FarmImageStorageRecord) {
  if (!image.data) return null;
  return `data:${image.mimeType};base64,${image.data}`;
}
