import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../../types/product';
import { ProductService } from '../../services/api';
import { Link } from 'react-router-dom';

export const AIAssistant: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ sender: 'user' | 'bot'; text: string; products?: Product[] }[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const chatHistoryRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            loadAllProducts();
            setMessages([
                { sender: 'bot', text: "Hello! How can I help you find the perfect product today?" },
                { sender: 'bot', text: 'Try asking "Show me a laptop" or "Any cheap headphones?".' }
            ]);
        }
    }, [isOpen]);

    useEffect(() => {
        if (chatHistoryRef.current) {
            chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
        }
    }, [messages]);

    const loadAllProducts = async () => {
        try {
            const products = await ProductService.getProducts();
            setAllProducts(products);
        } catch (error) {
            // Silent fail
        }
    };

    const toggleAssistant = () => {
        setIsOpen(!isOpen);
    };

    const handleSendMessage = () => {
        if (!inputValue.trim()) return;

        const userMessage = { sender: 'user' as 'user', text: inputValue };
        setMessages(prev => [...prev, userMessage]);
        
        processBotResponse(inputValue);

        setInputValue('');
    };

    const processBotResponse = (message: string) => {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
            setMessages(prev => [...prev, { sender: 'bot', text: "Hello! What can I help you find?" }]);
        } else if (lowerMessage.includes('shipping') || lowerMessage.includes('delivery')) {
            setMessages(prev => [...prev, { sender: 'bot', text: "We offer standard (5-7 days) and express (2-3 days) shipping. Free shipping on orders over 2000 Birr!" }]);
        } else if (lowerMessage.includes('thank')) {
            setMessages(prev => [...prev, { sender: 'bot', text: "You're welcome! Is there anything else I can help with?" }]);
        } else {
            // Remove common words and extract meaningful keywords
            const stopWords = ['show', 'me', 'a', 'an', 'the', 'any', 'some', 'find', 'get', 'want', 'need', 'looking', 'for', 'cheap'];
            const keywords = lowerMessage.split(' ').filter(word => word.length > 1 && !stopWords.includes(word));
            const results = searchProducts(keywords);
            
            if (results.length > 0) {
                setMessages(prev => [...prev, { sender: 'bot', text: "I found these products for you:", products: results.slice(0, 3) }]);
            } else {
                setMessages(prev => [...prev, { sender: 'bot', text: "I couldn't find any products matching that. Please try different keywords." }]);
            }
        }
    };
    
    const searchProducts = (keywords: string[]) => {
        if (!allProducts || allProducts.length === 0) return [];
        return allProducts.filter(product => {
            const productText = `${product.name} ${product.description} ${product.category_name}`.toLowerCase();
            return keywords.every(keyword => productText.includes(keyword));
        });
    };

    return (
        <>
            <div id="ai-assistant-window" className={`fixed bottom-20 right-4 w-full max-w-md h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 transition-all duration-300 transform ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 hidden'}`}>
                <div className="flex justify-between items-center p-4 bg-primary text-white rounded-t-2xl">
                    <h3 className="font-bold text-lg flex items-center"><i className="fas fa-robot mr-2"></i>Yegna Market Assistant</h3>
                    <button onClick={toggleAssistant} className="text-white hover:opacity-75 text-2xl">&times;</button>
                </div>
                <div ref={chatHistoryRef} id="chat-history" className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-3 rounded-lg ${msg.sender === 'user' ? 'bg-primary text-white max-w-xs' : 'bg-blue-100 text-gray-800 max-w-sm'}`}>
                                <p className="break-words">{msg.text}</p>
                                {msg.products && (
                                    <div className="mt-2 space-y-2">
                                        {msg.products.map(p => (
                                            <Link key={p.id} to={`/product/${p.id}`} className="block border rounded-lg p-2 my-2 hover:bg-gray-100">
                                                <div className="flex items-center space-x-2">
                                                    <div className="text-2xl">{p.image}</div>
                                                    <div>
                                                        <div className="font-bold">{p.name}</div>
                                                        <div className="text-sm text-primary">{p.price} Birr</div>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t bg-white rounded-b-2xl">
                    <div className="flex">
                        <input 
                            type="text" 
                            id="chat-input" 
                            placeholder="Ask about products..." 
                            className="flex-1 px-4 py-2 border-gray-300 border rounded-l-lg focus:ring-primary focus:border-primary"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <button id="chat-send-btn" className="bg-primary text-white px-4 rounded-r-lg hover:bg-secondary transition" onClick={handleSendMessage}>Send</button>
                    </div>
                </div>
            </div>

            <button id="ai-assistant-toggle" onClick={toggleAssistant} className="fixed bottom-4 right-4 w-16 h-16 bg-primary rounded-full text-white flex items-center justify-center shadow-lg z-40 hover:scale-110 transition-transform">
                <i className="fas fa-robot text-2xl"></i>
            </button>
        </>
    );
};
