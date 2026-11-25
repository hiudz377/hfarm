// Nội dung Chính sách bảo mật, Điều khoản sử dụng, Chính sách đổi trả hiển thị trong app (màn /policy/<slug>).
//
// ĐÂY LÀ BẢN NHÁP MẪU do đội phát triển soạn theo đúng cách app đang hoạt động, KHÔNG phải tư vấn pháp lý.
// Chủ cửa hàng cần đọc lại, sửa cho khớp quy định thực tế của mình (thời hạn đổi trả, ai chịu phí vận chuyển, thời gian hoàn tiền...)
// và nên nhờ người am hiểu pháp luật xem trước khi phát hành lên cửa hàng ứng dụng.
// Phải cập nhật lại khi app thay đổi cách thu thập dữ liệu (ví dụ thêm Sentry, Firebase, quảng cáo, vị trí, thông báo đẩy,
// thanh toán thẻ/ví) hoặc khi chuyển lên máy chủ thật (HTTPS).
// Không ghi số điện thoại / email thật ở đây: thông tin liên hệ lấy từ backend (STORE_*) và hiện ở cuối mỗi chính sách.
//
// Định dạng: mỗi mục { h: tiêu đề, p: [đoạn văn], ul: [gạch đầu dòng] } (p hiện trước, ul hiện sau).

const UPDATED = '25/11/2026';

const privacy = (store) => ({
  title: 'Chính sách bảo mật',
  updated: UPDATED,
  intro: `${store.name} tôn trọng quyền riêng tư của bạn. Chính sách này giải thích ứng dụng thu thập thông tin gì, dùng vào việc gì và bạn kiểm soát thông tin của mình như thế nào.`,
  sections: [
    {
      h: '1. Thông tin chúng tôi thu thập',
      p: ['Chỉ những thông tin cần thiết để bạn mua hàng và nhận hàng:'],
      ul: [
        'Tài khoản: họ tên, email và mật khẩu. Mật khẩu do hệ thống đăng nhập của cửa hàng lưu ở dạng đã băm (mã hóa một chiều), cửa hàng không đọc được mật khẩu của bạn.',
        'Giao nhận: tên người nhận, số điện thoại và địa chỉ bạn nhập trong Sổ địa chỉ hoặc khi đặt hàng.',
        'Đơn hàng: sản phẩm, giá, phương thức thanh toán, trạng thái giao hàng và ghi chú bạn gửi cho cửa hàng.',
        'Nội dung bạn tạo: giỏ hàng, danh sách yêu thích và đánh giá sản phẩm.',
        'Thanh toán chuyển khoản: chúng tôi ghi nhận giao dịch tiền vào tài khoản cửa hàng (số tiền, nội dung, thời gian) để đối soát đơn. Chúng tôi không lưu số thẻ hay mật khẩu ngân hàng của bạn.',
        'Lưu trên điện thoại của bạn: lịch sử tìm kiếm và phiên đăng nhập (lưu trong kho bảo mật của hệ điều hành). Xóa ứng dụng là các dữ liệu này mất theo.',
      ],
    },
    {
      h: '2. Chúng tôi không thu thập',
      p: ['Ứng dụng không truy cập vị trí, danh bạ, máy ảnh, micro hay thư viện ảnh của bạn. Ứng dụng không có quảng cáo và không tích hợp công cụ theo dõi của bên thứ ba.'],
    },
    {
      h: '3. Mục đích sử dụng',
      ul: [
        'Tạo và quản lý tài khoản, xác thực đăng nhập.',
        'Xử lý đơn hàng, đóng gói, giao hàng và thu tiền.',
        'Liên hệ bạn về đơn hàng (xác nhận, giao hàng, đổi trả).',
        'Hiển thị đánh giá của bạn cho khách khác sau khi cửa hàng duyệt (tên được rút gọn, ví dụ "Nguyễn V. A.").',
        'Cải thiện cửa hàng, ngăn chặn gian lận và tuân thủ nghĩa vụ pháp lý.',
      ],
    },
    {
      h: '4. Chia sẻ thông tin',
      p: ['Chúng tôi không bán thông tin cá nhân của bạn. Thông tin chỉ được chia sẻ trong các trường hợp cần thiết:'],
      ul: [
        'Đơn vị vận chuyển: tên, số điện thoại và địa chỉ nhận hàng để giao đơn của bạn.',
        'Ngân hàng: khi bạn chủ động chuyển khoản theo mã QR.',
        'Cơ quan nhà nước có thẩm quyền khi có yêu cầu hợp pháp.',
      ],
    },
    {
      h: '5. Lưu trữ và bảo vệ',
      p: [
        'Dữ liệu được lưu trên máy chủ do cửa hàng quản lý, có phân quyền truy cập: khách hàng chỉ xem được dữ liệu của chính mình, nhân viên chỉ truy cập phần được giao.',
        'Chúng tôi giữ thông tin trong thời gian bạn còn dùng tài khoản và thêm thời gian cần thiết để đối soát, bảo hành, giải quyết khiếu nại và theo quy định về kế toán, thuế.',
      ],
    },
    {
      h: '6. Quyền của bạn',
      ul: [
        'Xem và chỉnh sửa họ tên, số điện thoại, địa chỉ ngay trong mục Tài khoản.',
        'Yêu cầu cung cấp, chỉnh sửa hoặc xóa dữ liệu cá nhân, hoặc rút lại sự đồng ý, bằng cách liên hệ cửa hàng (thông tin ở cuối trang). Một số thông tin về đơn hàng đã giao dịch có thể phải giữ lại theo quy định pháp luật.',
      ],
    },
    {
      h: '7. Người dưới 16 tuổi',
      p: ['Nếu bạn dưới 16 tuổi, hãy dùng ứng dụng cùng sự đồng ý của cha mẹ hoặc người giám hộ.'],
    },
    {
      h: '8. Thay đổi chính sách',
      p: ['Khi chính sách thay đổi, chúng tôi cập nhật nội dung và ngày cập nhật ở đầu trang này. Việc tiếp tục sử dụng ứng dụng sau khi cập nhật nghĩa là bạn đồng ý với nội dung mới.'],
    },
  ],
});

const terms = (store) => ({
  title: 'Điều khoản sử dụng',
  updated: UPDATED,
  intro: `Khi tạo tài khoản hoặc đặt hàng trên ứng dụng ${store.name}, bạn đồng ý với các điều khoản dưới đây.`,
  sections: [
    {
      h: '1. Tài khoản',
      ul: [
        'Bạn cung cấp thông tin chính xác (họ tên, email, số điện thoại, địa chỉ) và tự bảo mật mật khẩu của mình.',
        'Bạn chịu trách nhiệm về hoạt động phát sinh từ tài khoản của bạn. Nếu nghi ngờ bị lộ mật khẩu, hãy đổi mật khẩu và liên hệ cửa hàng.',
        'Chúng tôi có thể khóa tài khoản có dấu hiệu gian lận hoặc vi phạm điều khoản.',
      ],
    },
    {
      h: '2. Đặt hàng',
      ul: [
        'Đơn hàng ở trạng thái "Chờ xác nhận" cho đến khi cửa hàng xác nhận. Bạn có thể tự hủy đơn khi đơn còn "Chờ xác nhận"; sau đó hãy liên hệ cửa hàng.',
        'Cửa hàng có thể từ chối hoặc hủy đơn trong các trường hợp như hết hàng, sai giá do lỗi hiển thị, không liên lạc được với người nhận hoặc địa chỉ không giao được. Nếu bạn đã thanh toán, cửa hàng sẽ hoàn lại tiền.',
        'Số lượng mua được giới hạn theo tồn kho hiện có. Mã giảm giá có điều kiện và thời hạn riêng, hiển thị khi áp dụng.',
      ],
    },
    {
      h: '3. Giá và thanh toán',
      ul: [
        'Giá hiển thị bằng đồng Việt Nam (₫). Phí vận chuyển tính theo khu vực nhận hàng và hiển thị trước khi bạn bấm đặt hàng.',
        'Thanh toán khi nhận hàng (COD): bạn trả tiền cho người giao hàng khi nhận.',
        'Chuyển khoản bằng mã QR: bạn chuyển đúng số tiền và đúng nội dung hiển thị trong ứng dụng. Đơn chưa thanh toán sau thời hạn hiển thị sẽ tự động hủy. Chuyển sai số tiền hoặc sai nội dung có thể làm chậm việc xác nhận đơn.',
      ],
    },
    {
      h: '4. Giao hàng',
      p: ['Thời gian giao hàng hiển thị trong ứng dụng là ước tính theo khu vực, có thể thay đổi do thời tiết, dịp lễ hoặc đơn vị vận chuyển. Bạn cần có người nhận đúng số điện thoại đã khai báo. Hãy kiểm tra hàng khi nhận.'],
    },
    {
      h: '5. Đổi trả',
      p: ['Việc đổi trả được thực hiện theo Chính sách đổi trả của cửa hàng (xem mục riêng trong ứng dụng).'],
    },
    {
      h: '6. Đánh giá và nội dung bạn gửi',
      ul: [
        'Đánh giá phải trung thực, liên quan đến sản phẩm bạn đã mua; không chứa nội dung xúc phạm, quảng cáo, thông tin cá nhân của người khác hay nội dung trái pháp luật.',
        'Cửa hàng có quyền duyệt, ẩn hoặc xóa đánh giá vi phạm, và được hiển thị đánh giá của bạn (tên được rút gọn) trong ứng dụng.',
      ],
    },
    {
      h: '7. Hình ảnh và nội dung của cửa hàng',
      p: ['Hình ảnh, logo và nội dung trong ứng dụng thuộc về cửa hàng. Màu sắc sản phẩm có thể chênh lệch nhẹ so với thực tế do màn hình hiển thị. Bạn không được sao chép hoặc sử dụng cho mục đích thương mại khi chưa được đồng ý.'],
    },
    {
      h: '8. Giới hạn trách nhiệm',
      p: ['Chúng tôi cố gắng để ứng dụng hoạt động liên tục nhưng không bảo đảm không bao giờ gián đoạn (bảo trì, lỗi mạng, sự cố ngoài tầm kiểm soát). Trong phạm vi pháp luật cho phép, trách nhiệm của cửa hàng đối với một đơn hàng không vượt quá giá trị của đơn hàng đó.'],
    },
    {
      h: '9. Thay đổi điều khoản và luật áp dụng',
      p: ['Chúng tôi có thể cập nhật điều khoản và ghi ngày cập nhật ở đầu trang. Điều khoản này tuân theo pháp luật Việt Nam.'],
    },
  ],
});

const returns = (store) => {
  const d = store.return_days;
  return {
    title: 'Chính sách đổi trả',
    updated: UPDATED,
    intro: `${store.name} hỗ trợ đổi size hoặc trả hàng trong ${d} ngày kể từ khi bạn nhận hàng, theo các điều kiện dưới đây.`,
    sections: [
      {
        h: '1. Điều kiện đổi trả',
        ul: [
          `Yêu cầu được gửi cho cửa hàng trong vòng ${d} ngày kể từ ngày nhận hàng.`,
          'Sản phẩm còn nguyên tình trạng ban đầu: chưa giặt, chưa qua sử dụng, còn tem mác và bao bì.',
          'Có mã đơn hàng (xem trong mục Đơn hàng của ứng dụng).',
          'Sản phẩm thuộc chương trình có ghi rõ "không đổi trả" (nếu có) không được áp dụng.',
        ],
      },
      {
        h: '2. Các trường hợp được hỗ trợ',
        ul: [
          'Đổi size hoặc đổi màu (tùy tồn kho; nếu hết hàng, cửa hàng sẽ đề xuất sản phẩm khác hoặc hoàn tiền).',
          'Sản phẩm bị lỗi từ nhà sản xuất (đường may, bung chỉ, loang màu...).',
          'Giao sai mẫu, sai size, thiếu hàng so với đơn đã đặt.',
          'Trả hàng vì không ưng ý (nếu sản phẩm đáp ứng điều kiện ở mục 1).',
        ],
      },
      {
        h: '3. Cách gửi yêu cầu',
        ul: [
          'Mở Tài khoản > Đơn hàng của tôi, chọn đơn cần hỗ trợ.',
          'Bấm Gọi điện, Nhắn Zalo hoặc Gửi email ở mục "Cần hỗ trợ?" (mã đơn được điền sẵn trong email).',
          'Nêu rõ sản phẩm, lý do và gửi kèm ảnh sản phẩm nếu bị lỗi. Cửa hàng sẽ phản hồi và hướng dẫn cách gửi hàng về.',
        ],
      },
      {
        h: '4. Chi phí vận chuyển',
        ul: [
          'Lỗi từ cửa hàng (hàng lỗi, giao sai, thiếu): cửa hàng chịu phí vận chuyển đổi trả.',
          'Đổi size, đổi ý: khách hàng chịu phí vận chuyển gửi hàng về, cửa hàng chịu phí gửi hàng mới (nếu có đổi).',
        ],
      },
      {
        h: '5. Hoàn tiền',
        p: [
          'Sau khi nhận và kiểm tra sản phẩm, cửa hàng hoàn tiền theo đúng hình thức bạn đã thanh toán (đơn chuyển khoản hoàn vào tài khoản ngân hàng bạn cung cấp; đơn COD hoàn qua chuyển khoản). Thời gian cụ thể được cửa hàng thông báo khi xác nhận yêu cầu.',
        ],
      },
      {
        h: '6. Hủy đơn',
        p: ['Bạn tự hủy được đơn khi đơn còn "Chờ xác nhận" (nút Hủy đơn trong chi tiết đơn). Đơn đã được xác nhận hoặc đang giao thì hãy liên hệ cửa hàng càng sớm càng tốt để được hỗ trợ.'],
      },
    ],
  };
};

export const POLICY_SLUGS = ['privacy', 'terms', 'returns'];

// Trả về nội dung chính sách theo slug (privacy | terms | returns), hoặc null nếu slug không có.
// Chỉ nhận slug nằm trong POLICY_SLUGS: tra thẳng vào object sẽ trúng cả "constructor", "__proto__"... (mở /policy/constructor sẽ sập màn).
export function getPolicy(slug, store) {
  if (!POLICY_SLUGS.includes(slug)) return null;
  return { privacy, terms, returns }[slug](store);
}
