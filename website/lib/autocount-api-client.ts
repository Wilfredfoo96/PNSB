/**
 * AutoCount API Client
 * TypeScript client library for the IIS-hosted AutoCount REST API
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Debtor {
  accNo: string;
  name?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  address4?: string;
  contact?: string;
  phone1?: string;
  email?: string;
  debtorType?: string;
  terms?: string;
  salesAgent?: string;
  isActive?: string;
  creditLimit?: number;
  taxCode?: string;
  taxRegNo?: string;
  registerNo?: string;
  lastModified?: string;
  currencyCode?: string;
}

export interface CreateDebtorRequest {
  accNo: string;
  name?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  address4?: string;
  contact?: string;
  phone1?: string;
  email?: string;
  debtorType?: string;
  terms?: string;
  salesAgent?: string;
  creditLimit?: number;
  taxCode?: string;
  taxRegNo?: string;
}

export interface UpdateDebtorRequest {
  name?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  address4?: string;
  contact?: string;
  phone1?: string;
  email?: string;
  debtorType?: string;
  terms?: string;
  salesAgent?: string;
  creditLimit?: number;
  taxCode?: string;
  taxRegNo?: string;
  isActive?: string;
}

export interface Item {
  itemCode: string;
  description?: string;
  desc2?: string;
  itemType?: string;
  itemCategory?: string;
  itemBrand?: string;
  itemGroup?: string;
  uom?: string;
  cost?: number;
  price?: number;
  isActive?: string;
  stockQty?: number;
  taxCode?: string;
  classification?: string;
}

export interface CreateItemRequest {
  itemCode: string;
  description?: string;
  desc2?: string;
  itemType?: string;
  itemCategory?: string;
  itemBrand?: string;
  itemGroup?: string;
  salesUOM?: string;
  purchaseUOM?: string;
  reportUOM?: string;
  baseUOM?: string;
  taxCode?: string;
  stockControl?: string;
  hasSerialNo?: string;
  hasBatchNo?: string;
  isActive?: string;
  cost?: number;
  price?: number;
}

export interface UpdateItemRequest {
  description?: string;
  desc2?: string;
  itemType?: string;
  itemCategory?: string;
  itemBrand?: string;
  itemGroup?: string;
  uom?: string;
  cost?: number;
  price?: number;
  isActive?: string;
}

export interface Invoice {
  docKey: number;
  docNo: string;
  docDate: string;
  debtorCode: string;
  debtorName?: string;
  status: 'Draft' | 'Posted' | 'Void';
  total?: number;
  tax?: number;
  lines: InvoiceLine[];
  createdAt: string;
  postedAt?: string;
}

export interface InvoiceLine {
  dtlKey: number;
  itemCode: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxAmount?: number;
  lineTotal?: number;
}

export interface CreateInvoiceRequest {
  idempotencyKey?: string;
  debtorCode: string;
  docDate: string;
  ref?: string;
  description?: string;
  lines: CreateInvoiceLineRequest[];
  remarks?: string;
}

export interface CreateInvoiceLineRequest {
  itemCode: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxCode?: string;
  description?: string;
}

export interface UpdateInvoiceRequest {
  docDate?: string;
  ref?: string;
  description?: string;
  lines?: CreateInvoiceLineRequest[];
  remarks?: string;
}

export interface DeliveryOrder {
  docKey: number;
  docNo: string;
  docDate: string;
  debtorCode: string;
  debtorName?: string;
  status: 'Draft' | 'Posted' | 'Void';
  total?: number;
  lines: DeliveryOrderLine[];
  createdAt: string;
  postedAt?: string;
}

export interface DeliveryOrderLine {
  dtlKey: number;
  itemCode: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  lineTotal?: number;
}

export interface CreateDeliveryOrderRequest {
  idempotencyKey?: string;
  debtorCode: string;
  docDate: string;
  ref?: string;
  description?: string;
  lines: CreateDeliveryOrderLineRequest[];
  remarks?: string;
  taxEntityName?: string | null;
  branchPrefix?: string | null; // Branch prefix for DO numbering (e.g., "SOTP1")
}

export interface CreateDeliveryOrderLineRequest {
  itemCode: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  description?: string;
  taxCode?: string | null;
}

export interface UpdateDeliveryOrderRequest {
  docDate?: string;
  ref?: string;
  description?: string;
  lines?: CreateDeliveryOrderLineRequest[];
  remarks?: string;
}

export class AutoCountApiClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(config: {
    baseUrl: string;
    apiKey: string;
    timeout?: number;
  }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
    };

    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.timeout),
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      
      // Check content type before parsing JSON
      const contentType = response.headers.get('content-type');
      let data: any;
      
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (jsonError) {
          // If JSON parsing fails, try to get text
          const text = await response.text();
          return {
            success: false,
            error: `HTTP ${response.status}`,
            message: text || 'Invalid JSON response from server',
            timestamp: new Date().toISOString(),
          };
        }
      } else {
        // Non-JSON response (likely an error page)
        const text = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}`,
          message: text || `Server returned ${response.status} ${response.statusText}`,
          timestamp: new Date().toISOString(),
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
          message: data.message || data.details || `Server returned ${response.status}`,
          timestamp: new Date().toISOString(),
        };
      }

      return data as ApiResponse<T>;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
          return {
            success: false,
            error: 'Request timeout',
            message: 'The request took too long to complete',
            timestamp: new Date().toISOString(),
          };
        }
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          return {
            success: false,
            error: 'Network error',
            message: 'Unable to connect to the API server. Please check your connection and API configuration.',
            timestamp: new Date().toISOString(),
          };
        }
        return {
          success: false,
          error: 'Request failed',
          message: error.message,
          timestamp: new Date().toISOString(),
        };
      }
      return {
        success: false,
        error: 'Unknown error',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Debtor (Customer) endpoints
  async getDebtors(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<ApiResponse<PaginatedResponse<Debtor>>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.search) queryParams.append('search', params.search);

    const query = queryParams.toString();
    return this.request<PaginatedResponse<Debtor>>(
      'GET',
      `/api/v1/debtors${query ? `?${query}` : ''}`
    );
  }

  async getDebtor(accNo: string): Promise<ApiResponse<Debtor>> {
    return this.request<Debtor>('GET', `/api/v1/debtors/${encodeURIComponent(accNo)}`);
  }

  async createDebtor(request: CreateDebtorRequest): Promise<ApiResponse<Debtor>> {
    return this.request<Debtor>('POST', '/api/v1/debtors', request);
  }

  async updateDebtor(accNo: string, request: UpdateDebtorRequest): Promise<ApiResponse<Debtor>> {
    return this.request<Debtor>('PUT', `/api/v1/debtors/${encodeURIComponent(accNo)}`, request);
  }

  async deleteDebtor(accNo: string): Promise<ApiResponse<boolean>> {
    return this.request<boolean>('DELETE', `/api/v1/debtors/${encodeURIComponent(accNo)}`);
  }

  // Item endpoints
  async getItems(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    activeOnly?: boolean;
  }): Promise<ApiResponse<PaginatedResponse<Item>>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.activeOnly !== undefined) queryParams.append('activeOnly', params.activeOnly.toString());

    const query = queryParams.toString();
    return this.request<PaginatedResponse<Item>>(
      'GET',
      `/api/v1/items${query ? `?${query}` : ''}`
    );
  }

  async getItem(itemCode: string): Promise<ApiResponse<Item>> {
    return this.request<Item>('GET', `/api/v1/items/${encodeURIComponent(itemCode)}`);
  }

  async createItem(request: CreateItemRequest): Promise<ApiResponse<Item>> {
    return this.request<Item>('POST', '/api/v1/items', request);
  }

  async updateItem(itemCode: string, request: UpdateItemRequest): Promise<ApiResponse<Item>> {
    return this.request<Item>('PUT', `/api/v1/items/${encodeURIComponent(itemCode)}`, request);
  }

  async deleteItem(itemCode: string): Promise<ApiResponse<boolean>> {
    return this.request<boolean>('DELETE', `/api/v1/items/${encodeURIComponent(itemCode)}`);
  }

  // Invoice endpoints
  async getInvoices(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
  }): Promise<ApiResponse<PaginatedResponse<Invoice>>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status) queryParams.append('status', params.status);

    const query = queryParams.toString();
    return this.request<PaginatedResponse<Invoice>>(
      'GET',
      `/api/v1/invoices${query ? `?${query}` : ''}`
    );
  }

  async getInvoice(docKey: number): Promise<ApiResponse<Invoice>> {
    return this.request<Invoice>('GET', `/api/v1/invoices/${docKey}`);
  }

  async getInvoiceByDocNo(docNo: string): Promise<ApiResponse<Invoice>> {
    return this.request<Invoice>('GET', `/api/v1/invoices/docno/${encodeURIComponent(docNo)}`);
  }

  async createDraftInvoice(request: CreateInvoiceRequest): Promise<ApiResponse<Invoice>> {
    return this.request<Invoice>('POST', '/api/v1/invoices/draft', request);
  }

  async updateDraftInvoice(docKey: number, request: UpdateInvoiceRequest): Promise<ApiResponse<Invoice>> {
    return this.request<Invoice>('PUT', `/api/v1/invoices/${docKey}`, request);
  }

  async postInvoice(docKey: number): Promise<ApiResponse<boolean>> {
    return this.request<boolean>('POST', `/api/v1/invoices/${docKey}/post`);
  }

  async voidInvoice(docKey: number): Promise<ApiResponse<boolean>> {
    return this.request<boolean>('POST', `/api/v1/invoices/${docKey}/void`);
  }

  // Delivery Order endpoints
  async getDeliveryOrders(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
  }): Promise<ApiResponse<PaginatedResponse<DeliveryOrder>>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status) queryParams.append('status', params.status);

    const query = queryParams.toString();
    return this.request<PaginatedResponse<DeliveryOrder>>(
      'GET',
      `/api/v1/delivery-orders${query ? `?${query}` : ''}`
    );
  }

  async getDeliveryOrder(docKey: number): Promise<ApiResponse<DeliveryOrder>> {
    return this.request<DeliveryOrder>('GET', `/api/v1/delivery-orders/${docKey}`);
  }

  async getDeliveryOrderByDocNo(docNo: string): Promise<ApiResponse<DeliveryOrder>> {
    return this.request<DeliveryOrder>('GET', `/api/v1/delivery-orders/docno/${encodeURIComponent(docNo)}`);
  }

  async getNextDeliveryOrderNumber(): Promise<ApiResponse<string>> {
    return this.request<string>('GET', '/api/v1/delivery-orders/next-number');
  }

  async createDraftDeliveryOrder(request: CreateDeliveryOrderRequest): Promise<ApiResponse<DeliveryOrder>> {
    return this.request<DeliveryOrder>('POST', '/api/v1/delivery-orders/draft', request);
  }

  async updateDraftDeliveryOrder(docKey: number, request: UpdateDeliveryOrderRequest): Promise<ApiResponse<DeliveryOrder>> {
    return this.request<DeliveryOrder>('PUT', `/api/v1/delivery-orders/${docKey}`, request);
  }

  async postDeliveryOrder(docKey: number): Promise<ApiResponse<boolean>> {
    return this.request<boolean>('POST', `/api/v1/delivery-orders/${docKey}/post`);
  }

  async voidDeliveryOrder(docKey: number): Promise<ApiResponse<boolean>> {
    return this.request<boolean>('POST', `/api/v1/delivery-orders/${docKey}/void`);
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string; version: string }>> {
    return this.request('GET', '/api/v1/health');
  }

  async getVersion(): Promise<ApiResponse<{ apiVersion: string; autocountVersion: string; timestamp: string }>> {
    return this.request('GET', '/api/v1/version');
  }

  // Settings endpoints
  async getTaxCodes(): Promise<ApiResponse<Array<{ taxCode: string; description?: string; taxRate: number; isActive: string }>>> {
    return this.request<Array<{ taxCode: string; description?: string; taxRate: number; isActive: string }>>('GET', '/api/v1/settings/tax-codes');
  }

  async createTaxCode(request: { taxCode: string; description?: string; taxRate: number }): Promise<ApiResponse<{ taxCode: string; description?: string; taxRate: number; isActive: string }>> {
    return this.request<{ taxCode: string; description?: string; taxRate: number; isActive: string }>('POST', '/api/v1/settings/tax-codes', request);
  }

  async getClassifications(): Promise<ApiResponse<Array<{ code: string; description?: string }>>> {
    return this.request<Array<{ code: string; description?: string }>>('GET', '/api/v1/settings/classifications');
  }

  async createClassification(request: { code: string; description?: string }): Promise<ApiResponse<{ code: string; description?: string }>> {
    return this.request<{ code: string; description?: string }>('POST', '/api/v1/settings/classifications', request);
  }
}

// Export singleton instance factory
export function createAutoCountApiClient(config: {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}): AutoCountApiClient {
  return new AutoCountApiClient(config);
}

