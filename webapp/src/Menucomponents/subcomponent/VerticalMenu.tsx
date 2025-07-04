import { List, TerminalWindow, X } from "@phosphor-icons/react";

function VerticalMenu() {
    const liStyle = "px-1 py-1"
    const isOpen = false

    return (
        <div className={`bg-gray-800 text-white rounded-tl-[10px] rounded-bl-[10px] relative ${isOpen ? "w-25" : "w-30"} 
    transition-all duration-300 ease-in-out overflow-hidden`}           style={{ border: "1px solid black" }}>
            <div className="p-4 text-lg font-bold border-gray-700">
                <button onClick={()=>{}}
                    className={`mb-2 p-1.5 border bg-transparent rounded absolute top-2 cursor-pointer ${isOpen ? "border-red-500 text-red-500 right-2" : "border-blue-500 text-blue-500 left-2"}`}>
                    {isOpen ? <X weight="bold" size={20} /> : <List weight="bold" size={20} />}
                </button>
            </div>
            <ul className="mt-10 p-2 space-y-4">
                <li className={liStyle}>
                    <a href="#" onClick={()=>{}} className="hover:text-gray-300"> 
                    <TerminalWindow size={20} weight="fill" color="#125C3A" className='inline-block mr-1 transform -translate-y-[2px]' /> 
                    Django 
                    </a>
                </li>
                <li className={liStyle}><a href="#" onClick={()=>{}} className="disabled-link hover:text-gray-300">
                    <TerminalWindow size={20} weight="fill" color="#6DB33F" className='inline-block mr-1 transform -translate-y-[2px]' />
                    Spring</a>
                </li>
                <li className={liStyle}>
                    <a href="#" onClick={()=>{}}  className="disabled-link hover:text-gray-300" >
                    <TerminalWindow size={20} weight="fill" color="#FF2D20" className='inline-block mr-1 transform -translate-y-[2px]' />
                    Laravel</a>
                </li>
                <li className={liStyle}><a href="#" onClick={()=>{}} className="disabled-link hover:text-gray-300">
                    <TerminalWindow size={20} weight="fill" color="#FF9900" className='inline-block mr-1 transform -translate-y-[2px]' />
                    EC2 instance</a>
                </li>
            </ul>
        </div>
    )
}

export default VerticalMenu