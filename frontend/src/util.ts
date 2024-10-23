
export const nanoTimestampToDate = (nanoTimestamp: number) => {
    return new Date(nanoTimestamp / 1000000)
}
export const milliTimestampToDate = (milliTimestamp: number) => {
    return new Date(milliTimestamp / 1000)
}