// public/js/modul.js //
const configCatClient = configcat.createClient('configcat-sdk-1/b7DcCO0dFEmCsj9M9cc77g/ZC8lKGaYRU-xHAfjXeEFQQ');

async function isFeatureEnabled(featureKey) {
    const enabled = await configCatClient.getValueAsync(featureKey, false);
    return enabled;
}

export { isFeatureEnabled };