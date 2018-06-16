function getPrecision(num) {
  let count = 0;
  while (num < 1) {
    num = num * 10;
    count++;
  }
  return count;
}

function getNumOfDecimals(num) {
  return (num + "").split(".")[1].length;
}

const coolDown = miliseconds => new Promise((resolve, reject) => setTimeout(resolve, miliseconds));

function sortDepthArr(arr, isDecending = false) {
  if (!Array.isArray(arr)) return arr;
  return isDecending ? arr.sort((a, b) => b[0] - a[0]) : arr.sort((a, b) => a[0] - b[0]);
}

module.exports = {
  getPrecision,
  getNumOfDecimals,
  coolDown, 
  sortDepthArr
};