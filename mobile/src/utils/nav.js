// Từ một màn Stack nằm trên các tab (Thanh toán, Thành công...) quay về một tab ('/', '/cart', '/orders').
// dismissTo lùi về màn (tabs) đã có sẵn bên dưới rồi chọn tab, nên không chồng thêm một bản (tabs) mới.
export const goToTab = (router, href) => router.dismissTo(href);

// Lùi một màn. Nếu không còn màn nào để lùi (mở thẳng bằng liên kết) thì thay bằng `fallback`,
// tránh cảnh báo "GO_BACK was not handled" và màn bị kẹt.
export const goBack = (router, fallback = '/') => (router.canGoBack() ? router.back() : router.replace(fallback));
